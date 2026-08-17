import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { SquareClient, SquareEnvironment } from 'square'
import { SERVICE_FEE_RATE, MAX_DELIVERY_MILES, SHOP_COMMISSION_RATE } from '@/lib/constants'
import { haversineDistance } from '@/lib/osrm'
import { isShopOpen, isShopOpenAt } from '@/lib/shop-hours'
import { notifyAdmins, sendEmail, sendSMS, sendOrderEmail, buildOrderEmailHtml } from '@/lib/sms'
import { pushAdmins } from '@/lib/push-server'
import { createDeliveryAndDispatch } from '@/lib/delivery-assignment'
import { getPayConfig } from '@/lib/pay-config'
import { checkRateLimit } from '@/lib/rate-limit'
import { awardLoyaltyPoints } from '@/lib/loyalty'
import { computeWelcomePromo } from '@/lib/promo'
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
      .select('id, email, name, phone')
      .eq('auth_id', authUser.id)
      .single()

    if (!ddUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { allowed } = await checkRateLimit(`checkout:${ddUser.id}`, 10, 60000)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const body = await request.json()
    const {
      shopId,
      items,
      delivery_address,
      delivery_street,
      delivery_city,
      delivery_instructions,
      tip,
      promo_code,
      scheduled_for,
      fulfillment_type,
      sourceId,
      verificationToken,
      idempotencyKey,
      customer_email,
    } = body

    // Where the customer receipt goes. Guests (anonymous sessions) have a
    // synthesized, non-deliverable dd_users.email, so use the email they typed
    // at checkout (if any); logged-in customers use their account email.
    const receiptEmail: string | null =
      (typeof customer_email === 'string' && customer_email.trim()) ||
      (authUser.is_anonymous ? null : ddUser.email) ||
      null

    const fulfillmentType: 'delivery' | 'pickup' = fulfillment_type === 'pickup' ? 'pickup' : 'delivery'
    const isPickup = fulfillmentType === 'pickup'

    // Orders scheduled more than 2h out are "held": we don't notify the store
    // or surface them in the shop queue now. They stay a paid 'pending' order,
    // hidden from the shop feed (and the stale-cancel cron) until 2h before the
    // slot — at which point they reappear as a fresh "new order" for the store.
    const SCHEDULE_HOLD_MS = 2 * 60 * 60 * 1000
    const isFarScheduled = !!scheduled_for && (new Date(scheduled_for).getTime() - Date.now() > SCHEDULE_HOLD_MS)

    // Delivery needs an address; pickup does not.
    if (!shopId || !items || items.length === 0 || (!isPickup && !delivery_address)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // ASAP orders require the shop to be open now. Scheduled orders are allowed
    // while closed, but the chosen slot must be in the future and land within
    // the shop's posted hours — otherwise the order can't actually be fulfilled.
    if (!scheduled_for) {
      const shopStatus = await isShopOpen(shopId)
      if (!shopStatus.open) {
        return NextResponse.json({ error: `Sorry, this shop is currently closed. ${shopStatus.message}` }, { status: 400 })
      }
    } else {
      const when = new Date(scheduled_for)
      if (isNaN(when.getTime()) || when.getTime() < Date.now() - 60_000) {
        return NextResponse.json({ error: 'Please pick a pickup or delivery time in the future.' }, { status: 400 })
      }
      const openThen = await isShopOpenAt(shopId, scheduled_for)
      if (!openThen) {
        return NextResponse.json({ error: 'Please choose a time when the shop is open.' }, { status: 400 })
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

    // Geocode delivery address + enforce delivery range (delivery orders only).
    let deliveryLat: number | null = null
    let deliveryLng: number | null = null
    let deliveryDistanceMiles = 0
    if (!isPickup) {
      // Geocode the plain street + city — the same string the delivery-quote
      // used — not the apt/bldg/floor-concatenated delivery_address, so the fee
      // and range check match what the customer was quoted and unit suffixes
      // can't trip up geocoding.
      const fullAddress = `${delivery_street || delivery_address}, ${delivery_city || ''}`

      // Geocode with Google (reliable) first, then fall back to Nominatim.
      const gKey = process.env.GOOGLE_PLACES_API_KEY
      if (gKey) {
        try {
          const gRes = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${gKey}`
          )
          const gData = await gRes.json()
          if (gData.status === 'OK' && gData.results?.[0]) {
            deliveryLat = gData.results[0].geometry.location.lat
            deliveryLng = gData.results[0].geometry.location.lng
          }
        } catch {
          // fall through to Nominatim
        }
      }
      if (deliveryLat == null || deliveryLng == null) {
        try {
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
          // handled by the fail-closed check below
        }
      }

      // Fail closed: an address we can't locate can't be range-checked, so we
      // must not silently accept it as an in-range delivery.
      if (deliveryLat == null || deliveryLng == null) {
        return NextResponse.json({ error: "We couldn't verify that delivery address. Please check the street, city, and ZIP and try again." }, { status: 400 })
      }

      // Per-shop delivery radius, falling back to the platform default.
      // Queried separately so this stays safe if the column isn't present yet.
      let maxMiles = MAX_DELIVERY_MILES
      const { data: radiusRow, error: radiusErr } = await svc
        .from('dd_shops').select('delivery_radius_miles').eq('id', shopId).single()
      if (!radiusErr && radiusRow?.delivery_radius_miles != null) {
        maxMiles = Number(radiusRow.delivery_radius_miles)
      }
      const dist = haversineDistance(shop.lat, shop.lng, deliveryLat, deliveryLng)
      deliveryDistanceMiles = dist
      if (dist > maxMiles) {
        return NextResponse.json({ error: `Sorry, this address is outside our delivery range (${dist.toFixed(1)} mi). We deliver up to ${maxMiles} miles from the shop.` }, { status: 400 })
      }
    }

    // Distance-based delivery fee: the base fee covers the free radius, then a
    // per-mile charge applies beyond it. This keeps long deliveries from going
    // negative (the driver is paid per mile), while short deliveries stay at the
    // flat base fee. Free-miles + per-mile rate are admin-configurable.
    const payCfg = await getPayConfig()
    const baseDeliveryFee = shop?.delivery_fee ?? payCfg.defaultDeliveryFee
    const extraMiles = Math.max(0, deliveryDistanceMiles - payCfg.deliveryFreeMiles)
    const deliveryFee = isPickup
      ? 0
      : Math.round((baseDeliveryFee + extraMiles * payCfg.deliveryPerExtraMile) * 100) / 100

    // SECURITY: never trust client-supplied prices. Look up the real price for
    // each item from dd_menu_items for THIS shop and overwrite it — otherwise a
    // caller could POST price:0.01 and pay a penny for any order. Unknown or
    // unavailable items are rejected.
    const menuIds = [...new Set(items.map((i: { menu_item_id: string }) => i.menu_item_id))]
    const { data: menuRows } = await svc
      .from('dd_menu_items')
      .select('id, name, price, is_available')
      .eq('shop_id', shopId)
      .in('id', menuIds)
    const priceMap = new Map((menuRows || []).map((m: { id: string; name: string; price: number; is_available: boolean }) => [m.id, m]))
    for (const it of items as { menu_item_id: string; price: number; name: string; quantity: number }[]) {
      const m = priceMap.get(it.menu_item_id) as { name: string; price: number; is_available: boolean } | undefined
      if (!m || m.is_available === false) {
        return NextResponse.json({ error: `"${it.name || 'An item'}" is no longer available. Please refresh your cart.` }, { status: 400 })
      }
      it.price = Number(m.price) // authoritative server price
      it.name = m.name
    }

    // Calculate totals
    const subtotal = items.reduce(
      (sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity,
      0
    )
    const serviceFee = Math.round(subtotal * shopFeeRate * 100) / 100
    // Texas Comptroller Rule 3.293: separately-stated delivery and service
    // fees on prepared-food sales are part of the taxable sale price. Tip
    // is not. All checkout paths must agree on the tax base or the customer
    // gets taxed differently depending on payment method.
    const taxableBasis = subtotal + deliveryFee + serviceFee
    const tax = Math.round(taxableBasis * shopTaxRate * 100) / 100
    const tipAmount = tip || 0
    // Promo recomputed server-side from the real subtotal; client value ignored.
    // marginCap (service fee + commission; tax/tip/delivery excluded) keeps the
    // discount inside platform earnings — never the shop payout.
    const platformMargin = serviceFee + subtotal * SHOP_COMMISSION_RATE
    const promo = await computeWelcomePromo({ svc, customerId: ddUser.id, phone: ddUser.phone, deliveryAddress: delivery_address, deliveryCity: delivery_city, subtotal, code: promo_code, marginCap: platformMargin })
    const promoDiscount = promo?.discount ?? 0
    const promoCode = promo?.code ?? null
    const total = Math.round((subtotal + tax + deliveryFee + serviceFee + tipAmount - promoDiscount) * 100) / 100

    // Idempotency: the browser sends a stable key per checkout attempt. If a
    // response was lost AFTER the card was charged, the retry carries the same
    // key — return the existing (live) order instead of charging again.
    // Cancelled (declined) orders release their key, so a fixed-card retry with
    // a fresh key still goes through.
    if (idempotencyKey) {
      const { data: dup } = await svc
        .from('dd_orders')
        .select('id')
        .eq('checkout_key', idempotencyKey)
        .neq('status', 'cancelled')
        .maybeSingle()
      if (dup) return NextResponse.json({ ok: true, orderId: dup.id })
    }

    // Create the order in Supabase
    const { data: order, error: orderError } = await supabase
      .from('dd_orders')
      .insert({
        checkout_key: idempotencyKey ?? null,
        customer_id: ddUser.id,
        // Denormalized so the POS/receipt can show who ordered without
        // reading dd_users (RLS blocks staff from other users' rows), and
        // so the order stays self-contained if the account is later removed.
        customer_name: ddUser.name ?? null,
        customer_phone: ddUser.phone ?? null,
        customer_email: receiptEmail,
        shop_id: shopId,
        status: 'pending',
        subtotal,
        tax,
        delivery_fee: deliveryFee,
        service_fee: serviceFee,
        tip: tipAmount,
        total,
        payment_method: 'square',
        fulfillment_type: fulfillmentType,
        order_type: fulfillmentType, // 'delivery' | 'pickup' — was defaulting to 'delivery'
        delivery_address: isPickup ? '' : delivery_address,
        delivery_city: isPickup ? '' : (delivery_city || ''),
        delivery_lat: deliveryLat,
        delivery_lng: deliveryLng,
        delivery_instructions: isPickup ? null : (delivery_instructions || null),
        promo_code: promoCode,
        promo_discount: promoDiscount || 0,
        scheduled_for: scheduled_for || null,
      })
      .select()
      .single()

    if (orderError) {
      // A concurrent request with the same key won the unique index — return
      // its order rather than surfacing a raw DB error (still no double charge).
      if (idempotencyKey && (orderError.code === '23505' || /duplicate key/i.test(orderError.message))) {
        const { data: dup } = await svc
          .from('dd_orders')
          .select('id')
          .eq('checkout_key', idempotencyKey)
          .maybeSingle()
        if (dup) return NextResponse.json({ ok: true, orderId: dup.id })
      }
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

    // Award loyalty points: 1 point per $1 of subtotal (fire and forget).
    awardLoyaltyPoints(svc, { userId: ddUser.id, orderId: order.id, subtotal, source: 'online order' })
      .catch((e) => console.error('Loyalty points error:', e))

    // Notify admins of new order (fire and forget)
    const shopName = shop?.name || 'a shop'
    const itemCount = items.reduce((sum: number, i: any) => sum + (i.quantity || 1), 0)
    const smsMsg = `New DonutDash Order!\n$${total.toFixed(2)} - ${itemCount} item${itemCount > 1 ? 's' : ''} from ${shopName}\nDelivery: ${delivery_address}\nOrder #${order.id.slice(0, 8)}`
    const emailHtml = `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
        <h2 style="color:#FF8C00;margin-bottom:4px;">New DonutDash&trade; Order!</h2>
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
    // Held scheduled orders are announced 2h before the slot (when they
    // re-enter the shop feed), not at checkout time.
    if (!isFarScheduled) {
      notifyAdmins(smsMsg, `New Order: $${total.toFixed(2)} from ${shopName}`, emailHtml).catch(() => {})
      pushAdmins(`New Order — $${total.toFixed(2)}`, `${itemCount} item${itemCount > 1 ? 's' : ''} from ${shopName}`).catch(() => {})
    }

    // Notify shop owner via SMS + email (fire and forget) — every order alerts
    // the owner's phone.
    if (!isFarScheduled && shop?.owner_id) {
      (async () => {
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

    // Build line items for Square (itemized so the merchant dashboard and
    // Square receipts show each product, not just a single lump total).
    const squareLineItems: any[] = items.map((item: { name: string; price: number; quantity: number; special_instructions?: string | null }) => ({
      name: item.name,
      quantity: String(item.quantity),
      basePriceMoney: {
        amount: BigInt(Math.round(item.price * 100)),
        currency: 'USD',
      },
      ...(item.special_instructions ? { note: String(item.special_instructions).slice(0, 500) } : {}),
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

    // Add delivery fee (delivery orders only)
    if (deliveryFee > 0) {
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
        name: isPickup ? 'Tip' : 'Driver Tip',
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

    // Two payment modes:
    //  - Embedded (Web Payments SDK): the client sends a one-time `sourceId`
    //    (card / Apple Pay / Google Pay), so we charge it inline into the
    //    platform Square account and confirm the order immediately.
    //  - Fallback: create a Square-hosted payment link the client redirects to.
    let paymentLinkUrl: string | null = null
    if (sourceId) {
      let paymentId: string | undefined
      let cardFingerprint: string | null = null
      let cardBrand: string | null = null
      let cardLast4: string | null = null
      try {
        // Create an itemized Square order first, then attach the payment to it.
        // Without an order, the charge posts as a single lump sum and the
        // Square dashboard/receipt can't break out the individual line items.
        let squareOrderId: string | undefined
        let chargeAmount = BigInt(Math.round(total * 100))
        try {
          const orderRes = await square.orders.create({
            order: squareOrder,
            idempotencyKey: idempotencyKey ? `${idempotencyKey}-ord` : crypto.randomUUID(),
          })
          squareOrderId = orderRes.order?.id
          // Charge the order's own computed total so the payment and order
          // totals always match (attaching a mismatched amount is rejected).
          if (orderRes.order?.totalMoney?.amount != null) {
            chargeAmount = orderRes.order.totalMoney.amount
          }
        } catch (orderErr) {
          // Non-fatal: if order creation fails, fall back to a plain lump-sum
          // charge so checkout still succeeds (just without itemization).
          console.error('[checkout] Square order create failed — charging without itemization', { orderId: order.id, orderErr })
        }

        // Reuse the browser's stable key so a retried charge (same key) is
        // de-duped by Square itself — the definitive backstop against a double
        // charge even if the order-row dedup above is somehow bypassed.
        const paymentResult = await square.payments.create({
          sourceId,
          idempotencyKey: idempotencyKey ?? crypto.randomUUID(),
          amountMoney: { amount: chargeAmount, currency: 'USD' },
          ...(squareOrderId ? { orderId: squareOrderId } : {}),
          locationId: process.env.SQUARE_LOCATION_ID!,
          referenceId: order.id,
          note: `DonutDash Order #${order.id.slice(0, 8)} - ${shop?.name || 'Order'}`,
          ...(verificationToken ? { verificationToken } : {}),
        })
        if (paymentResult.payment?.status !== 'COMPLETED') throw new Error('not completed')
        paymentId = paymentResult.payment.id
        // Square's stable per-card id — recorded for post-hoc welcome-offer abuse
        // detection (see below). Present for card payments; wallets may omit it.
        // Also grab brand + last 4 so the receipt shows "Visa •••• 1234".
        const cardInfo = (paymentResult.payment as { cardDetails?: { card?: { fingerprint?: string; cardBrand?: string; last4?: string } } }).cardDetails?.card
        cardFingerprint = cardInfo?.fingerprint ?? null
        cardBrand = cardInfo?.cardBrand ?? null
        cardLast4 = cardInfo?.last4 ?? null
      } catch (payErr) {
        // Void the pending order and translate Square's decline codes into a
        // friendly message instead of surfacing the raw 400 body.
        // Release the idempotency key so the customer can retry a fixed card as
        // a fresh attempt (a declined charge never took the customer's money).
        await svc.from('dd_orders').update({ status: 'cancelled', cancellation_reason: 'Payment declined', checkout_key: null }).eq('id', order.id)
        const e = payErr as { errors?: { code?: string }[]; body?: { errors?: { code?: string }[] } }
        const codes = [
          ...(Array.isArray(e?.errors) ? e.errors.map(x => x.code) : []),
          ...(Array.isArray(e?.body?.errors) ? e.body!.errors!.map(x => x.code) : []),
        ]
        let message = 'Payment could not be completed. Please check your card details or try another card.'
        if (codes.includes('CVV_FAILURE')) message = 'Card declined — the security code (CVV) is incorrect. Please re-enter your card.'
        else if (codes.includes('ADDRESS_VERIFICATION_FAILURE')) message = 'Card declined — the billing ZIP does not match. Please check it and try again.'
        else if (codes.includes('INSUFFICIENT_FUNDS')) message = 'Card declined — insufficient funds.'
        else if (codes.includes('CARD_EXPIRED') || codes.includes('INVALID_EXPIRATION')) message = 'Card declined — expired or invalid expiration date.'
        else if (codes.includes('TRANSACTION_LIMIT')) message = 'Card declined — the amount exceeds the transaction limit. Try a smaller order or a different card.'
        else if (codes.includes('CARD_DECLINED') || codes.includes('GENERIC_DECLINE')) message = 'Card declined. Please try a different card.'
        else if (codes.includes('CARD_NOT_SUPPORTED')) message = 'This card type is not supported. Please try a different card.'
        return NextResponse.json({ error: message }, { status: 400 })
      }
      // Use the service client — RLS blocks the customer-scoped client from
      // updating order status/payment, which would silently leave a paid
      // order stuck 'pending' (and auto-cancelled as stale).
      // The card is already charged, so this write MUST land — otherwise the
      // order stays 'pending' with no payment_id and the stale-order cron would
      // cancel a paid order. Retry a few times before giving up on a reconcile.
      let confirmErr: unknown = null
      for (let attempt = 0; attempt < 3; attempt++) {
        const { error } = await svc
          .from('dd_orders')
          .update({ status: isFarScheduled ? 'pending' : 'confirmed', payment_id: paymentId, card_fingerprint: cardFingerprint, card_brand: cardBrand, card_last4: cardLast4 })
          .eq('id', order.id)
        if (!error) { confirmErr = null; break }
        confirmErr = error
        await new Promise(r => setTimeout(r, 400 * (attempt + 1)))
      }
      if (confirmErr) {
        console.error('[checkout] PAID but confirm update failed after retries — reconcile', { orderId: order.id, paymentId, confirmErr })
      }
      // Welcome-offer abuse DETECTION (not prevention): if a welcome discount was
      // applied and this exact card has ordered before, flag it in the logs. We
      // can't block pre-charge without breaking wallet payments, so surface it
      // for review instead. Phone + address gates above are the hard blocks.
      if (cardFingerprint && promoDiscount > 0) {
        const { count: priorCardOrders } = await svc
          .from('dd_orders')
          .select('id', { count: 'exact', head: true })
          .eq('card_fingerprint', cardFingerprint)
          .neq('status', 'cancelled')
          .neq('id', order.id)
        if ((priorCardOrders ?? 0) > 0) {
          console.warn('[promo] welcome discount claimed by a repeat card', { orderId: order.id, cardFingerprint, priorCardOrders, promoDiscount })
        }
      }
      // Dispatch a driver immediately for ASAP delivery orders so a driver gets
      // the order the moment it's placed (held scheduled orders dispatch when
      // they're released ~2h before the slot). The orphan-dispatch cron remains
      // a backstop if this ever fails.
      if (!isFarScheduled && !isPickup) {
        createDeliveryAndDispatch({
          id: order.id, shopLat: shop.lat, shopLng: shop.lng,
          dropLat: deliveryLat, dropLng: deliveryLng, tip: tipAmount,
        }).catch(e => console.error('[checkout] dispatch failed', order.id, e))
      }
    } else {
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
      paymentLinkUrl = paymentLink.url
      await svc
        .from('dd_orders')
        .update({ payment_id: paymentLink.id })
        .eq('id', order.id)
    }

    // Send order confirmation email to customer (fire and forget)
    if (receiptEmail) {
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
      sendOrderEmail(receiptEmail, `Order Confirmed - DonutDash #${order.id.slice(0, 8).toUpperCase()}`, confirmHtml).catch(() => {})
    }

    // Embedded flow: order is already charged + confirmed → { ok, orderId }.
    // Fallback flow: return the hosted payment-link URL to redirect to.
    return NextResponse.json({ ok: true, url: paymentLinkUrl, orderId: order.id })
  } catch (err) {
    console.error('Checkout error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create checkout session' }, { status: 500 })
  }
}
