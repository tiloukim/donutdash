import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { SquareClient, SquareEnvironment } from 'square'
import { SERVICE_FEE_RATE, DEFAULT_DELIVERY_FEE, MAX_DELIVERY_MILES } from '@/lib/constants'
import { haversineDistance } from '@/lib/osrm'
import { isShopOpen } from '@/lib/shop-hours'
import { notifyAdmins, sendEmail, sendSMS, sendOrderEmail, buildOrderEmailHtml } from '@/lib/sms'
import { checkRateLimit } from '@/lib/rate-limit'
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

    const { allowed } = checkRateLimit(`checkout:${ddUser.id}`, 10, 60000)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
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
      scheduled_for,
    } = body

    if (!shopId || !items || items.length === 0 || !delivery_address) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if shop is currently open (skip for scheduled orders)
    if (!scheduled_for) {
      const shopStatus = await isShopOpen(shopId)
      if (!shopStatus.open) {
        return NextResponse.json({ error: `Sorry, this shop is currently closed. ${shopStatus.message}` }, { status: 400 })
      }
    }

    // Fetch shop info including coordinates
    const svc = createServiceClient()
    const { data: shop } = await svc.from('dd_shops').select('name, service_fee_pct, delivery_fee, min_order, tax_rate, lat, lng, owner_id, paused, pause_reason, pause_until').eq('id', shopId).single()

    // Check if shop has paused orders (auto-unpause if timer expired)
    if (shop?.paused) {
      if (shop.pause_until && new Date(shop.pause_until) <= new Date()) {
        await svc.from('dd_shops').update({ paused: false, pause_reason: null, pause_until: null }).eq('id', shopId)
      } else {
        return NextResponse.json({ error: shop.pause_reason || 'This shop is temporarily not accepting orders. Please try again later.' }, { status: 400 })
      }
    }

    if (!shop || shop.lat == null || shop.lng == null) {
      return NextResponse.json({ error: 'This shop has not set their location yet. Please contact the shop owner.' }, { status: 400 })
    }
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

    if (deliveryLat != null && deliveryLng != null) {
      const dist = haversineDistance(shop.lat, shop.lng, deliveryLat, deliveryLng)
      if (dist > MAX_DELIVERY_MILES) {
        return NextResponse.json({ error: `Sorry, this address is outside our delivery range (${dist.toFixed(1)} mi). We deliver up to ${MAX_DELIVERY_MILES} miles from the shop.` }, { status: 400 })
      }
    }

    // Use shop's flat delivery fee (or platform default)
    let deliveryFee = shop?.delivery_fee ?? DEFAULT_DELIVERY_FEE

    // DonutDash Pass disabled for now
    const hasPass = false

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
        scheduled_for: scheduled_for || null,
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

    // Award loyalty points: 1 point per $1 spent (fire and forget)
    const loyaltyPoints = Math.floor(subtotal)
    if (loyaltyPoints > 0) {
      (async () => {
        try {
          // Upsert loyalty record
          const { data: existing } = await svc
            .from('dd_loyalty')
            .select('points, lifetime_points')
            .eq('user_id', ddUser.id)
            .single()

          if (existing) {
            const newLifetime = existing.lifetime_points + loyaltyPoints
            const newTier = newLifetime >= 5000 ? 'platinum' : newLifetime >= 1500 ? 'gold' : newLifetime >= 500 ? 'silver' : 'bronze'
            await svc.from('dd_loyalty').update({
              points: existing.points + loyaltyPoints,
              lifetime_points: newLifetime,
              tier: newTier,
              updated_at: new Date().toISOString(),
            }).eq('user_id', ddUser.id)
          } else {
            const newTier = loyaltyPoints >= 5000 ? 'platinum' : loyaltyPoints >= 1500 ? 'gold' : loyaltyPoints >= 500 ? 'silver' : 'bronze'
            await svc.from('dd_loyalty').insert({
              user_id: ddUser.id,
              points: loyaltyPoints,
              lifetime_points: loyaltyPoints,
              tier: newTier,
            })
          }

          // Log the transaction
          await svc.from('dd_loyalty_transactions').insert({
            user_id: ddUser.id,
            order_id: order.id,
            points: loyaltyPoints,
            type: 'earned',
            description: `Earned ${loyaltyPoints} pts from order #${order.id.slice(0, 8)}`,
          })
        } catch (e) {
          console.error('Loyalty points error:', e)
        }
      })()
    }

    // Notify admins of new order (fire and forget)
    const shopName = shop?.name || 'a shop'
    const itemCount = items.reduce((sum: number, i: any) => sum + (i.quantity || 1), 0)
    const smsMsg = `New DonutDash Order!\n$${total.toFixed(2)} - ${itemCount} item${itemCount > 1 ? 's' : ''} from ${shopName}\nDelivery: ${delivery_address}\nOrder #${order.id.slice(0, 8)}`
    const emailHtml = `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
        <h2 style="color:#FF8C00;margin-bottom:4px;">New DonutDash Order!</h2>
        <p style="color:#666;font-size:13px;margin-top:0;">Order #${order.id.slice(0, 8)}</p>
        <div style="background:#FFF8F0;border:1px solid #FFE8D6;border-radius:12px;padding:16px;margin:16px 0;">
          <div style="font-size:28px;font-weight:800;color:#10B981;">$${total.toFixed(2)}</div>
          <div style="font-size:14px;color:#666;margin-top:4px;">${itemCount} item${itemCount > 1 ? 's' : ''} from <strong>${shopName}</strong></div>
        </div>
        <div style="font-size:14px;line-height:1.8;color:#333;">
          <div><strong>Delivery:</strong> ${delivery_address}</div>
          <div><strong>Subtotal:</strong> $${subtotal.toFixed(2)}</div>
          <div><strong>Delivery Fee:</strong> $${deliveryFee.toFixed(2)}</div>
          <div><strong>Service Fee:</strong> $${serviceFee.toFixed(2)}</div>
          ${tipAmount > 0 ? `<div><strong>Tip:</strong> $${tipAmount.toFixed(2)}</div>` : ''}
        </div>
        <a href="https://donutdash.app/admin/orders" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#FF8C00;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">View in Admin</a>
      </div>
    `
    notifyAdmins(smsMsg, `New Order: $${total.toFixed(2)} from ${shopName}`, emailHtml).catch(() => {})

    // Notify shop owner via email + SMS (fire and forget)
    if (shop?.owner_id) {
      (async () => {
        const { data: owner } = await svc.from('dd_users').select('email, phone').eq('id', shop.owner_id).single()
        // SMS to shop owner
        if (owner?.phone) {
          const shopSms = `New DonutDash order! ${itemCount} item${itemCount > 1 ? 's' : ''} - $${total.toFixed(2)}. Open your shop app to accept: donutdash.app/shop/orders`
          sendSMS(owner.phone.startsWith('+') ? owner.phone : `+1${owner.phone.replace(/\D/g, '')}`, shopSms).catch(() => {})
        }
        if (owner?.email) {
          const ownerEmailHtml = `
            <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
              <h2 style="color:#FF8C00;margin-bottom:4px;">New Order for ${shopName}!</h2>
              <p style="color:#666;font-size:13px;margin-top:0;">Order #${order.id.slice(0, 8)}</p>
              <div style="background:#FFF8F0;border:1px solid #FFE8D6;border-radius:12px;padding:16px;margin:16px 0;">
                <div style="font-size:28px;font-weight:800;color:#10B981;">$${total.toFixed(2)}</div>
                <div style="font-size:14px;color:#666;margin-top:4px;">${itemCount} item${itemCount > 1 ? 's' : ''}</div>
              </div>
              <div style="font-size:14px;line-height:1.8;color:#333;">
                <div><strong>Delivery:</strong> ${delivery_address}</div>
                ${ddUser.name ? `<div><strong>Customer:</strong> ${ddUser.name}</div>` : ''}
              </div>
              <a href="https://donutdash.app/shop/orders" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#FF8C00;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">View &amp; Accept</a>
            </div>
          `
          await sendEmail(owner.email, `New Order! ${itemCount} items - $${total.toFixed(2)}`, ownerEmailHtml)
        }
      })().catch(() => {})
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
    if (!hasPass) {
      squareLineItems.push({
        name: 'Delivery Fee',
        quantity: '1',
        basePriceMoney: {
          amount: BigInt(Math.round(deliveryFee * 100)),
          currency: 'USD',
        },
      })
    }

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

    // Send order confirmation email to customer (fire and forget)
    if (ddUser.email) {
      const itemsList = items.map((item: { name: string; quantity: number; price: number }) =>
        `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#444;"><span>${item.quantity}x ${item.name}</span><span>$${(item.price * item.quantity).toFixed(2)}</span></div>`
      ).join('')
      const extraHtml = `
        <div style="background:#FFF8F0;border:1px solid #FFE8D6;border-radius:10px;padding:14px;margin:12px 0;">
          <div style="font-size:13px;color:#888;margin-bottom:8px;">From <strong style="color:#222;">${shopName}</strong></div>
          ${itemsList}
          <div style="margin-top:10px;font-size:14px;line-height:1.8;color:#333;">
            <div style="display:flex;justify-content:space-between;"><span>Subtotal</span><span>$${subtotal.toFixed(2)}</span></div>
            <div style="display:flex;justify-content:space-between;"><span>Tax</span><span>$${tax.toFixed(2)}</span></div>
            <div style="display:flex;justify-content:space-between;"><span>Delivery Fee</span><span>$${deliveryFee.toFixed(2)}</span></div>
            <div style="display:flex;justify-content:space-between;"><span>Service Fee</span><span>$${serviceFee.toFixed(2)}</span></div>
            ${tipAmount > 0 ? `<div style="display:flex;justify-content:space-between;"><span>Tip</span><span>$${tipAmount.toFixed(2)}</span></div>` : ''}
            ${promoDiscount > 0 ? `<div style="display:flex;justify-content:space-between;color:#10B981;"><span>Promo Discount</span><span>-$${promoDiscount.toFixed(2)}</span></div>` : ''}
            <div style="display:flex;justify-content:space-between;font-weight:700;font-size:16px;border-top:1px solid #FFE8D6;padding-top:8px;margin-top:8px;"><span>Total</span><span>$${total.toFixed(2)}</span></div>
          </div>
        </div>
        <p style="font-size:13px;color:#666;margin:8px 0 0 0;"><strong>Delivery to:</strong> ${delivery_address}</p>
      `
      const confirmHtml = buildOrderEmailHtml(
        order.id,
        'Order Confirmed!',
        'Thank you for your order! We\'ve received it and the shop will start preparing it soon.',
        extraHtml
      )
      sendOrderEmail(ddUser.email, `Order Confirmed - DonutDash #${order.id.slice(0, 8).toUpperCase()}`, confirmHtml).catch(() => {})
    }

    return NextResponse.json({ url: paymentLink.url, orderId: order.id })
  } catch (err) {
    console.error('Checkout error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create checkout session' }, { status: 500 })
  }
}
