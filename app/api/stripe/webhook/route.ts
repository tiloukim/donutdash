import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'
import { notifyAdmins, sendEmail, sendSMS, sendOrderEmail, buildOrderEmailHtml } from '@/lib/sms'
import { awardLoyaltyPoints } from '@/lib/loyalty'

/**
 * Stripe webhook handler.
 * Listens for `checkout.session.completed` to create the order in dd_orders
 * (mirrors the logic in /api/checkout which creates orders inline for Square).
 *
 * Webhook endpoint to register in Stripe Dashboard:
 *   https://donutdash.app/api/stripe/webhook
 */
export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const stripe = getStripe()
  let event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any
    const meta = session.metadata || {}

    // Skip if no shop_id in metadata (not a DonutDash checkout)
    if (!meta.shop_id || !meta.customer_id) {
      return NextResponse.json({ received: true })
    }

    try {
      const svc = createServiceClient()

      // Idempotency: Stripe retries on any non-2xx, and the partial unique
      // index on dd_orders.payment_id will reject duplicates server-side,
      // but a pre-check avoids the noisy 500 + admin notification + items
      // insert work on every retry. Same payment → same order, return 200.
      const paymentId = session.payment_intent || session.id
      if (paymentId) {
        const { data: existing } = await svc
          .from('dd_orders')
          .select('id')
          .eq('payment_id', paymentId)
          .maybeSingle()
        if (existing) {
          return NextResponse.json({ received: true, deduped: true, order_id: existing.id })
        }
      }

      // Parse order data from metadata
      const shopId = meta.shop_id
      const customerId = meta.customer_id
      const subtotal = parseFloat(meta.subtotal) || 0
      const tax = parseFloat(meta.tax) || 0
      const deliveryFee = parseFloat(meta.delivery_fee) || 0
      const serviceFee = parseFloat(meta.service_fee) || 0
      const smallOrderFee = parseFloat(meta.small_order_fee) || 0
      const commissionPct = meta.commission_pct ? parseFloat(meta.commission_pct) : null
      const tipAmount = parseFloat(meta.tip) || 0
      const total = parseFloat(meta.total) || 0
      const fulfillmentType: 'delivery' | 'pickup' = meta.fulfillment_type === 'pickup' ? 'pickup' : 'delivery'
      const isPickup = fulfillmentType === 'pickup'
      const deliveryAddress = isPickup ? null : (meta.delivery_address || '')
      const deliveryCity = isPickup ? null : (meta.delivery_city || '')
      const deliveryLat = isPickup ? null : (meta.delivery_lat ? parseFloat(meta.delivery_lat) : null)
      const deliveryLng = isPickup ? null : (meta.delivery_lng ? parseFloat(meta.delivery_lng) : null)
      const deliveryInstructions = isPickup ? null : (meta.delivery_instructions || null)
      const promoCode = meta.promo_code || null
      const promoDiscount = parseFloat(meta.promo_discount) || 0
      const scheduledFor = meta.scheduled_for || null

      // Denormalize the customer's name/phone onto the order so the POS and
      // receipt can show who ordered without reading dd_users (RLS blocks
      // staff from other users' rows), and so the order stays self-contained.
      let customerName: string | null = null
      let customerPhone: string | null = null
      {
        const { data: cust } = await svc
          .from('dd_users')
          .select('name, phone')
          .eq('id', customerId)
          .maybeSingle()
        customerName = cust?.name ?? null
        customerPhone = cust?.phone ?? null
      }

      // Pull the card brand + last4 from the PaymentIntent's charge so the
      // receipt can show e.g. "Visa ••4242". Best-effort — never fail the order.
      let cardBrand: string | null = null
      let cardLast4: string | null = null
      try {
        const piId = typeof session.payment_intent === 'string' ? session.payment_intent : null
        if (piId) {
          const pi = await stripe.paymentIntents.retrieve(piId, {
            expand: ['latest_charge.payment_method_details'],
          })
          const card = (pi as any)?.latest_charge?.payment_method_details?.card
          if (card) { cardBrand = card.brand ?? null; cardLast4 = card.last4 ?? null }
        }
      } catch (e) {
        console.error('Stripe webhook: could not read card brand/last4', e)
      }

      // items_json is the compact tuple format from /api/stripe/checkout:
      //   [[menu_item_id, qty, price_cents, instructions], ...]
      // Names + image_urls are looked up from dd_menu_items below.
      let items: Array<{
        menu_item_id: string
        quantity: number
        price: number
        name: string
        image_url: string | null
        special_instructions: string | null
      }> = []
      try {
        const compact: Array<[string, number, number, string]> = JSON.parse(meta.items_json || '[]')
        const ids = compact.map(([id]) => id).filter(Boolean)
        const { data: menuRows } = await svc
          .from('dd_menu_items')
          .select('id, name, image_url, price')
          .in('id', ids)
        const menuById = new Map<string, { name: string; image_url: string | null; price: number }>(
          (menuRows || []).map((m: any) => [m.id, { name: m.name, image_url: m.image_url, price: Number(m.price) }])
        )
        items = compact.map(([id, qty, priceCents, instr]) => {
          const m = menuById.get(id)
          return {
            menu_item_id: id,
            quantity: qty,
            price: priceCents / 100,
            name: m?.name || 'Item',
            image_url: m?.image_url || null,
            special_instructions: instr || null,
          }
        })
      } catch (e) {
        console.error('Failed to parse items_json from Stripe metadata', e)
      }

      // Create order in dd_orders
      const { data: order, error: orderError } = await svc
        .from('dd_orders')
        .insert({
          customer_id: customerId,
          customer_name: customerName,
          customer_phone: customerPhone,
          card_brand: cardBrand,
          card_last4: cardLast4,
          shop_id: shopId,
          status: 'pending',
          fulfillment_type: fulfillmentType,
          subtotal,
          tax,
          delivery_fee: deliveryFee,
          service_fee: serviceFee,
          small_order_fee: smallOrderFee,
          commission_pct: commissionPct,
          tip: tipAmount,
          total,
          payment_method: 'stripe',
          payment_id: session.payment_intent || session.id,
          delivery_address: deliveryAddress,
          delivery_city: deliveryCity,
          delivery_lat: deliveryLat,
          delivery_lng: deliveryLng,
          delivery_instructions: deliveryInstructions,
          promo_code: promoCode,
          promo_discount: promoDiscount,
          scheduled_for: scheduledFor,
        })
        .select()
        .single()

      if (orderError) {
        // Unique violation on payment_id = a race with another concurrent
        // delivery of the same event. Treat as success so Stripe stops retrying.
        if (orderError.code === '23505') {
          return NextResponse.json({ received: true, deduped: true })
        }
        console.error('Stripe webhook: order creation failed:', orderError)
        return NextResponse.json({ error: orderError.message }, { status: 500 })
      }

      if (items.length > 0) {
        const orderItems = items.map(item => ({
          order_id: order.id,
          menu_item_id: item.menu_item_id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image_url: item.image_url,
          special_instructions: item.special_instructions,
        }))

        const { error: itemsError } = await svc
          .from('dd_order_items')
          .insert(orderItems)

        if (itemsError) {
          console.error('Stripe webhook: order items insert failed:', itemsError)
          await svc.from('dd_orders').delete().eq('id', order.id)
          return NextResponse.json({ error: itemsError.message }, { status: 500 })
        }
      }

      // Award loyalty points: 1 point per $1 of subtotal (fire and forget).
      awardLoyaltyPoints(svc, { userId: customerId, orderId: order.id, subtotal, source: 'online order' })
        .catch((e) => console.error('Loyalty points error:', e))

      // Fetch shop info for notifications
      const { data: shop } = await svc
        .from('dd_shops')
        .select('name, owner_id')
        .eq('id', shopId)
        .single()

      const shopName = shop?.name || 'a shop'
      const itemCount = items.reduce((sum: number, i: any) => sum + (i.quantity || 1), 0)

      // Notify admins (fire and forget)
      const fulfillmentLine = isPickup ? `Pickup at ${shopName}` : `Delivery: ${deliveryAddress}`
      const smsMsg = `New DonutDash Order!\n$${total.toFixed(2)} - ${itemCount} item${itemCount > 1 ? 's' : ''} from ${shopName}\n${fulfillmentLine}\nOrder #${order.id.slice(0, 8)}\nPaid via Stripe`
      const emailHtml = `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
          <h2 style="color:#FF8C00;margin-bottom:4px;">New DonutDash Order!</h2>
          <p style="color:#666;font-size:13px;margin-top:0;">Order #${order.id.slice(0, 8)} (Stripe)</p>
          <div style="background:#FFF8F0;border:1px solid #FFE8D6;border-radius:12px;padding:16px;margin:16px 0;">
            <div style="font-size:28px;font-weight:800;color:#10B981;">$${total.toFixed(2)}</div>
            <div style="font-size:14px;color:#666;margin-top:4px;">${itemCount} item${itemCount > 1 ? 's' : ''} from <strong>${shopName}</strong></div>
          </div>
          <div style="font-size:14px;line-height:1.8;color:#333;">
            ${isPickup
              ? `<div><strong>Fulfillment:</strong> Pickup at ${shopName}</div>`
              : `<div><strong>Delivery:</strong> ${deliveryAddress}</div>`}
            <div><strong>Subtotal:</strong> $${subtotal.toFixed(2)}</div>
            ${!isPickup ? `<div><strong>Delivery Fee:</strong> $${deliveryFee.toFixed(2)}</div>` : ''}
            <div><strong>Service Fee:</strong> $${serviceFee.toFixed(2)}</div>
            ${tipAmount > 0 ? `<div><strong>Tip:</strong> $${tipAmount.toFixed(2)}</div>` : ''}
          </div>
          <a href="https://donutdash.app/admin/orders" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#FF8C00;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">View in Admin</a>
        </div>
      `
      notifyAdmins(smsMsg, `New Order: $${total.toFixed(2)} from ${shopName}`, emailHtml).catch(() => {})

      // Notify shop owner (fire and forget)
      if (shop?.owner_id) {
        ;(async () => {
          const { data: owner } = await svc.from('dd_users').select('email, phone').eq('id', shop.owner_id).single()
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
                  ${isPickup
                    ? `<div><strong>Fulfillment:</strong> Customer pickup</div>`
                    : `<div><strong>Delivery:</strong> ${deliveryAddress}</div>`}
                  ${meta.customer_name ? `<div><strong>Customer:</strong> ${meta.customer_name}</div>` : ''}
                </div>
                <a href="https://donutdash.app/shop/orders" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#FF8C00;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">View &amp; Accept</a>
              </div>
            `
            await sendEmail(owner.email, `New Order! ${itemCount} items - $${total.toFixed(2)}`, ownerEmailHtml)
          }
        })().catch(() => {})
      }

      // Send order confirmation email to customer (fire and forget)
      const customerEmail = meta.customer_email
      if (customerEmail) {
        const itemsList = items.map((item: any) =>
          `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#444;"><span>${item.quantity}x ${item.name}</span><span>$${(item.price * item.quantity).toFixed(2)}</span></div>`
        ).join('')
        const extraHtml = `
          <div style="background:#FFF8F0;border:1px solid #FFE8D6;border-radius:10px;padding:14px;margin:12px 0;">
            <div style="font-size:13px;color:#888;margin-bottom:8px;">From <strong style="color:#222;">${shopName}</strong></div>
            ${itemsList}
            <div style="margin-top:10px;font-size:14px;line-height:1.8;color:#333;">
              <div style="display:flex;justify-content:space-between;"><span>Subtotal</span><span>$${subtotal.toFixed(2)}</span></div>
              <div style="display:flex;justify-content:space-between;"><span>Tax</span><span>$${tax.toFixed(2)}</span></div>
              ${!isPickup ? `<div style="display:flex;justify-content:space-between;"><span>Delivery Fee</span><span>$${deliveryFee.toFixed(2)}</span></div>` : ''}
              <div style="display:flex;justify-content:space-between;"><span>Service Fee</span><span>$${serviceFee.toFixed(2)}</span></div>
              ${tipAmount > 0 ? `<div style="display:flex;justify-content:space-between;"><span>Tip</span><span>$${tipAmount.toFixed(2)}</span></div>` : ''}
              ${promoDiscount > 0 ? `<div style="display:flex;justify-content:space-between;color:#10B981;"><span>Promo Discount</span><span>-$${promoDiscount.toFixed(2)}</span></div>` : ''}
              <div style="display:flex;justify-content:space-between;font-weight:700;font-size:16px;border-top:1px solid #FFE8D6;padding-top:8px;margin-top:8px;"><span>Total</span><span>$${total.toFixed(2)}</span></div>
            </div>
          </div>
          <p style="font-size:13px;color:#666;margin:8px 0 0 0;">
            ${isPickup
              ? `<strong>Pickup at:</strong> ${shopName}`
              : `<strong>Delivery to:</strong> ${deliveryAddress}`}
          </p>
        `
        const confirmHtml = buildOrderEmailHtml(
          order.id,
          'Order Confirmed!',
          'Thank you for your order! We\'ve received it and the shop will start preparing it soon.',
          extraHtml
        )
        sendOrderEmail(customerEmail, `Order Confirmed - DonutDash #${order.id.slice(0, 8).toUpperCase()}`, confirmHtml).catch(() => {})
      }

    } catch (err) {
      console.error('Stripe webhook processing error:', err)
      return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
    }
  }

  return NextResponse.json({ received: true })
}
