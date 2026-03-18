import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { SquareClient, SquareEnvironment } from 'square'
import { SERVICE_FEE_RATE, DEFAULT_DELIVERY_FEE, DELIVERY_FEE_BASE, DELIVERY_FEE_PER_MILE } from '@/lib/constants'
import { haversineDistance } from '@/lib/osrm'
import { isShopOpen } from '@/lib/shop-hours'
import crypto from 'crypto'

function getSquareClient() {
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN!,
    environment: process.env.SQUARE_ENVIRONMENT === 'production'
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox,
  })
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: ddUser } = await supabase
      .from('dd_users')
      .select('id, email, name')
      .eq('auth_id', authUser.id)
      .single()

    if (!ddUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      shopId,
      items,
      delivery_address,
      delivery_city,
      delivery_instructions,
      tip,
      promo_code,
      promo_discount,
    } = body

    if (!shopId || !items || items.length === 0 || !delivery_address) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if shop is currently open
    const shopStatus = await isShopOpen(shopId)
    if (!shopStatus.open) {
      return NextResponse.json({ error: `Sorry, this shop is currently closed. ${shopStatus.message}` }, { status: 400 })
    }

    // Fetch shop info including coordinates
    const svc = createServiceClient()
    const { data: shop } = await svc.from('dd_shops').select('name, service_fee_pct, delivery_fee, min_order, tax_rate, lat, lng').eq('id', shopId).single()
    const shopFeeRate = shop ? shop.service_fee_pct / 100 : SERVICE_FEE_RATE
    const shopTaxRate = shop?.tax_rate ? shop.tax_rate / 100 : 0

    // Geocode delivery address to get coordinates
    let deliveryLat: number | null = null
    let deliveryLng: number | null = null
    try {
      const fullAddress = `${delivery_address}, ${delivery_city || ''}`
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=1`,
        { headers: { 'User-Agent': 'DonutDash/1.0' } }
      )
      const geoData = await geoRes.json()
      if (geoData?.[0]) {
        deliveryLat = parseFloat(geoData[0].lat)
        deliveryLng = parseFloat(geoData[0].lon)
      }
    } catch {
      // Geocoding failed — continue without coordinates
    }

    // Calculate distance-based delivery fee
    let distanceMiles = 2 // default
    if (deliveryLat && deliveryLng && shop?.lat && shop?.lng) {
      distanceMiles = haversineDistance(shop.lat, shop.lng, deliveryLat, deliveryLng)
    }
    const deliveryFee = Math.round((DELIVERY_FEE_BASE + distanceMiles * DELIVERY_FEE_PER_MILE) * 100) / 100

    // Calculate totals
    const subtotal = items.reduce(
      (sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity,
      0
    )
    const tax = Math.round(subtotal * shopTaxRate * 100) / 100
    const serviceFee = Math.round(subtotal * shopFeeRate * 100) / 100
    const tipAmount = tip || 0
    const promoDiscount = promo_discount && promo_discount > 0 ? Math.round(promo_discount * 100) / 100 : 0
    const total = Math.round((subtotal + tax + deliveryFee + serviceFee + tipAmount - promoDiscount) * 100) / 100

    // Create the order in Supabase
    const { data: order, error: orderError } = await supabase
      .from('dd_orders')
      .insert({
        customer_id: ddUser.id,
        shop_id: shopId,
        status: 'pending',
        subtotal,
        tax,
        delivery_fee: deliveryFee,
        service_fee: serviceFee,
        tip: tipAmount,
        total,
        payment_method: 'square',
        delivery_address,
        delivery_city: delivery_city || '',
        delivery_lat: deliveryLat,
        delivery_lng: deliveryLng,
        delivery_instructions: delivery_instructions || null,
        promo_code: promo_code || null,
        promo_discount: promoDiscount || 0,
      })
      .select()
      .single()

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 })
    }

    // Insert order items
    const orderItems = items.map((item: {
      menu_item_id: string
      name: string
      price: number
      quantity: number
      image_url: string | null
      special_instructions: string | null
    }) => ({
      order_id: order.id,
      menu_item_id: item.menu_item_id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      image_url: item.image_url || null,
      special_instructions: item.special_instructions || null,
    }))

    const { error: itemsError } = await supabase
      .from('dd_order_items')
      .insert(orderItems)

    if (itemsError) {
      await supabase.from('dd_orders').delete().eq('id', order.id)
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    // Create Square Checkout
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const square = getSquareClient()

    // Build line items for Square
    const squareLineItems = items.map((item: { name: string; price: number; quantity: number }) => ({
      name: item.name,
      quantity: String(item.quantity),
      basePriceMoney: {
        amount: BigInt(Math.round(item.price * 100)),
        currency: 'USD',
      },
    }))

    // Add tax
    if (tax > 0) {
      squareLineItems.push({
        name: 'Sales Tax',
        quantity: '1',
        basePriceMoney: {
          amount: BigInt(Math.round(tax * 100)),
          currency: 'USD',
        },
      })
    }

    // Add delivery fee
    squareLineItems.push({
      name: 'Delivery Fee',
      quantity: '1',
      basePriceMoney: {
        amount: BigInt(Math.round(deliveryFee * 100)),
        currency: 'USD',
      },
    })

    // Add service fee
    squareLineItems.push({
      name: 'Service Fee',
      quantity: '1',
      basePriceMoney: {
        amount: BigInt(Math.round(serviceFee * 100)),
        currency: 'USD',
      },
    })

    // Add tip
    if (tipAmount > 0) {
      squareLineItems.push({
        name: 'Driver Tip',
        quantity: '1',
        basePriceMoney: {
          amount: BigInt(Math.round(tipAmount * 100)),
          currency: 'USD',
        },
      })
    }

    // Build Square order with optional discount
    const squareOrder: any = {
      locationId: process.env.SQUARE_LOCATION_ID!,
      lineItems: squareLineItems,
      referenceId: order.id,
    }

    if (promoDiscount > 0) {
      squareOrder.discounts = [{
        name: `Promo: ${promo_code || 'Discount'}`,
        amountMoney: {
          amount: BigInt(Math.round(promoDiscount * 100)),
          currency: 'USD',
        },
        scope: 'ORDER',
      }]
    }

    const checkoutResponse = await square.checkout.paymentLinks.create({
      idempotencyKey: crypto.randomUUID(),
      order: squareOrder,
      checkoutOptions: {
        redirectUrl: `${origin}/checkout/success?order_id=${order.id}`,
        merchantSupportEmail: ddUser.email,
      },
      paymentNote: `DonutDash Order #${order.id.slice(0, 8)} - ${shop?.name || 'Order'}`,
    })

    const paymentLink = checkoutResponse.paymentLink
    if (!paymentLink?.url) {
      console.error('Square checkout error: no payment link returned', checkoutResponse)
      return NextResponse.json({ error: 'Failed to create checkout' }, { status: 500 })
    }

    // Update order with payment link id
    await supabase
      .from('dd_orders')
      .update({ payment_id: paymentLink.id })
      .eq('id', order.id)

    return NextResponse.json({ url: paymentLink.url, orderId: order.id })
  } catch (err) {
    console.error('Checkout error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create checkout session' }, { status: 500 })
  }
}
