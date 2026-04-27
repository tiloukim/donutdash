import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createPayPalOrder } from '@/lib/paypal'
import { SERVICE_FEE_RATE, DEFAULT_DELIVERY_FEE } from '@/lib/constants'
import { isShopOpen } from '@/lib/shop-hours'
import { notifyAdmins, sendEmail, sendSMS, buildOrderEmailHtml } from '@/lib/sms'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: ddUser } = await supabase
      .from('dd_users').select('id, email, name').eq('auth_id', authUser.id).single()
    if (!ddUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const { allowed } = checkRateLimit(`checkout:${ddUser.id}`, 10, 60000)
    if (!allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })

    const body = await request.json()
    const {
      shopId, items, delivery_address, delivery_city,
      delivery_instructions, tip, promo_code, promo_discount, scheduled_for,
    } = body

    if (!shopId || !items || items.length === 0 || !delivery_address) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check shop open
    if (!scheduled_for) {
      const shopStatus = await isShopOpen(shopId)
      if (!shopStatus.open) {
        return NextResponse.json({ error: `Sorry, this shop is currently closed. ${shopStatus.message}` }, { status: 400 })
      }
    }

    const svc = createServiceClient()
    const { data: shop } = await svc.from('dd_shops')
      .select('name, service_fee_pct, delivery_fee, min_order, tax_rate, lat, lng, owner_id, paused, pause_reason, pause_until')
      .eq('id', shopId).single()

    if (shop?.paused) {
      if (shop.pause_until && new Date(shop.pause_until) <= new Date()) {
        await svc.from('dd_shops').update({ paused: false, pause_reason: null, pause_until: null }).eq('id', shopId)
      } else {
        return NextResponse.json({ error: shop.pause_reason || 'Shop temporarily not accepting orders.' }, { status: 400 })
      }
    }

    const shopFeeRate = shop ? shop.service_fee_pct / 100 : SERVICE_FEE_RATE
    const shopTaxRate = shop?.tax_rate ? shop.tax_rate / 100 : 0

    // Geocode
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
    } catch {}

    // Use shop's flat delivery fee (or platform default)
    const deliveryFee = shop?.delivery_fee ?? DEFAULT_DELIVERY_FEE

    const subtotal = items.reduce(
      (sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity, 0
    )
    const tax = Math.round(subtotal * shopTaxRate * 100) / 100
    const serviceFee = Math.round(subtotal * shopFeeRate * 100) / 100
    const tipAmount = tip || 0
    const promoDiscountAmt = promo_discount && promo_discount > 0 ? Math.round(promo_discount * 100) / 100 : 0
    const total = Math.round((subtotal + tax + deliveryFee + serviceFee + tipAmount - promoDiscountAmt) * 100) / 100

    // Create order in DB
    const { data: order, error: orderError } = await supabase
      .from('dd_orders')
      .insert({
        customer_id: ddUser.id,
        shop_id: shopId,
        status: 'pending',
        subtotal, tax,
        delivery_fee: deliveryFee,
        service_fee: serviceFee,
        tip: tipAmount,
        total,
        payment_method: 'paypal',
        delivery_address,
        delivery_city: delivery_city || '',
        delivery_lat: deliveryLat,
        delivery_lng: deliveryLng,
        delivery_instructions: delivery_instructions || null,
        promo_code: promo_code || null,
        promo_discount: promoDiscountAmt || 0,
        scheduled_for: scheduled_for || null,
      })
      .select().single()

    if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 })

    // Insert order items
    const orderItems = items.map((item: any) => ({
      order_id: order.id,
      menu_item_id: item.menu_item_id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      image_url: item.image_url || null,
      special_instructions: item.special_instructions || null,
    }))
    const { error: itemsError } = await supabase.from('dd_order_items').insert(orderItems)
    if (itemsError) {
      await supabase.from('dd_orders').delete().eq('id', order.id)
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    // Create PayPal order
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || 'https://www.donutdash.app'
    const shopName = shop?.name || 'Order'

    const paypalOrder = await createPayPalOrder({
      orderId: order.id,
      amount: total,
      description: `DonutDash Order #${order.id.slice(0, 8)} - ${shopName}`,
      returnUrl: `${origin}/checkout/paypal-success?order_id=${order.id}`,
      cancelUrl: `${origin}/checkout?cancelled=true`,
    })

    // Find the approval URL
    const approveUrl = paypalOrder.links?.find((l: any) => l.rel === 'payer-action')?.href
      || paypalOrder.links?.find((l: any) => l.rel === 'approve')?.href

    if (!approveUrl) {
      console.error('No PayPal approve URL:', paypalOrder)
      return NextResponse.json({ error: 'Failed to create PayPal checkout' }, { status: 500 })
    }

    // Save PayPal order ID
    await supabase.from('dd_orders').update({ payment_id: paypalOrder.id }).eq('id', order.id)

    // Notify admin + shop (fire and forget)
    const itemCount = items.reduce((sum: number, i: any) => sum + (i.quantity || 1), 0)
    const smsMsg = `New DonutDash Order (PayPal)!\n$${total.toFixed(2)} - ${itemCount} items from ${shopName}\nOrder #${order.id.slice(0, 8)}`
    notifyAdmins(smsMsg).catch(() => {})

    if (shop?.owner_id) {
      (async () => {
        const { data: owner } = await svc.from('dd_users').select('email, phone').eq('id', shop.owner_id).single()
        if (owner?.phone) {
          sendSMS(owner.phone.startsWith('+') ? owner.phone : `+1${owner.phone.replace(/\D/g, '')}`,
            `New DonutDash order! ${itemCount} items - $${total.toFixed(2)}. Open: donutdash.app/shop/orders`
          ).catch(() => {})
        }
      })().catch(() => {})
    }

    return NextResponse.json({
      paypalOrderId: paypalOrder.id,
      approveUrl,
      orderId: order.id,
    })
  } catch (err: any) {
    console.error('PayPal create error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
