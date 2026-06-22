import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'
import { SERVICE_FEE_RATE, DEFAULT_DELIVERY_FEE, MAX_DELIVERY_MILES, SHOP_COMMISSION_RATE, SMALL_ORDER_FEE, MIN_ORDER_AMOUNT, BASE_DELIVERY_RADIUS_MILES, PER_EXTRA_MILE_FEE } from '@/lib/constants'
import { haversineDistance } from '@/lib/osrm'
import { isShopOpen } from '@/lib/shop-hours'
import { checkRateLimit } from '@/lib/rate-limit'
import { computeWelcomePromo } from '@/lib/promo'

/**
 * POST — Create a Stripe Checkout Session with platform fee (15%) routed
 *        to the connected shop's Stripe account.
 *
 * Accepts the same payload as /api/checkout (Square).
 * The order is NOT created here — it's created in the webhook handler
 * after payment succeeds, to avoid orphaned unpaid orders.
 */
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

    const { allowed } = await checkRateLimit(`stripe-checkout:${ddUser.id}`, 10, 60000)
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
      scheduled_for,
      fulfillment_type,
    } = body

    const fulfillmentType: 'delivery' | 'pickup' = fulfillment_type === 'pickup' ? 'pickup' : 'delivery'
    const isPickup = fulfillmentType === 'pickup'

    if (!shopId || !items || items.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!isPickup && !delivery_address) {
      return NextResponse.json({ error: 'Missing delivery address' }, { status: 400 })
    }

    // Check if shop is currently open (skip for scheduled orders)
    if (!scheduled_for) {
      const shopStatus = await isShopOpen(shopId)
      if (!shopStatus.open) {
        return NextResponse.json({ error: `Sorry, this shop is currently closed. ${shopStatus.message}` }, { status: 400 })
      }
    }

    // Fetch shop info
    const svc = createServiceClient()
    const { data: shop } = await svc
      .from('dd_shops')
      .select('name, service_fee_pct, commission_pct, delivery_fee, min_order, tax_rate, lat, lng, owner_id, paused, pause_reason, pause_until, stripe_account_id, stripe_onboarding_complete')
      .eq('id', shopId)
      .single()

    if (!shop?.stripe_account_id || !shop?.stripe_onboarding_complete) {
      return NextResponse.json({ error: 'This shop has not connected Stripe payments yet.' }, { status: 400 })
    }

    if (shop.lat == null || shop.lng == null) {
      return NextResponse.json({ error: 'This shop has not set their location yet. Please contact the shop owner.' }, { status: 400 })
    }

    // Check if shop has paused orders
    if (shop.paused) {
      if (shop.pause_until && new Date(shop.pause_until) <= new Date()) {
        await svc.from('dd_shops').update({ paused: false, pause_reason: null, pause_until: null }).eq('id', shopId)
      } else {
        return NextResponse.json({ error: shop.pause_reason || 'This shop is temporarily not accepting orders. Please try again later.' }, { status: 400 })
      }
    }

    const shopFeeRate = shop.service_fee_pct / 100 || SERVICE_FEE_RATE
    const shopCommissionRate = shop.commission_pct != null ? Number(shop.commission_pct) / 100 : SHOP_COMMISSION_RATE
    const shopCommissionPct = Math.round(shopCommissionRate * 10000) / 100   // snapshot for the order row
    const shopTaxRate = shop.tax_rate ? shop.tax_rate / 100 : 0

    // Pickup orders skip geocoding, distance checks, and delivery fees.
    let deliveryLat: number | null = null
    let deliveryLng: number | null = null
    let deliveryFee = 0

    if (!isPickup) {
      // Geocode delivery address. We REQUIRE this to succeed so that:
      //   1. The distance-based delivery fee charges the customer correctly
      //      (otherwise rural / partial addresses silently fall back to base fee).
      //   2. The 3-mile delivery radius check actually fires.
      //   3. Driver pay later in the pipeline has real coordinates instead of
      //      hitting the `: 0` fallback for unknown distance.
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
        // Falls through to the missing-coords check below.
      }

      if (deliveryLat == null || deliveryLng == null) {
        return NextResponse.json(
          { error: 'We could not verify this delivery address. Please double-check the street and city, or try a more specific address.' },
          { status: 400 },
        )
      }

      const distMiles = haversineDistance(shop.lat, shop.lng, deliveryLat, deliveryLng)
      if (distMiles > MAX_DELIVERY_MILES) {
        return NextResponse.json({ error: `Sorry, this address is outside our delivery range (${distMiles.toFixed(1)} mi). We deliver up to ${MAX_DELIVERY_MILES} miles from the shop.` }, { status: 400 })
      }

      // Distance-based delivery fee: base covers the first BASE_DELIVERY_RADIUS_MILES;
      // every mile beyond adds PER_EXTRA_MILE_FEE ($1.50). Customer charge and
      // driver pay both derive from the same distMiles, so they stay aligned.
      const baseDeliveryFee = shop.delivery_fee ?? DEFAULT_DELIVERY_FEE
      const extraMiles = Math.max(0, distMiles - BASE_DELIVERY_RADIUS_MILES)
      deliveryFee = Math.round((baseDeliveryFee + extraMiles * PER_EXTRA_MILE_FEE) * 100) / 100
    }

    const subtotal = items.reduce(
      (sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity,
      0
    )
    const serviceFee = Math.round(subtotal * shopFeeRate * 100) / 100
    const smallOrderFee = subtotal < MIN_ORDER_AMOUNT ? SMALL_ORDER_FEE : 0
    // Texas Comptroller Rule 3.293: separately-stated delivery and service fees
    // on prepared-food sales are part of the taxable sale price. Tip is not.
    const taxableBasis = subtotal + deliveryFee + serviceFee + smallOrderFee
    const tax = Math.round(taxableBasis * shopTaxRate * 100) / 100
    // Pickup orders have no driver, so tips are forced to $0.
    const tipAmount = isPickup ? 0 : (tip || 0)
    // Recompute the promo on the server from the real subtotal — the client's
    // promo_discount is display-only and never trusted. Returns null if the
    // customer isn't eligible (not new / promo disabled / wrong code).
    const promo = await computeWelcomePromo({ svc, customerId: ddUser.id, subtotal, code: promo_code })
    const promoDiscount = promo?.discount ?? 0
    const promoCode = promo?.code ?? null
    const total = Math.round((subtotal + tax + deliveryFee + serviceFee + smallOrderFee + tipAmount - promoDiscount) * 100) / 100

    // Stripe destination charges transfer (total - application_fee_amount) to the
    // connected (shop) account. We want the shop to net exactly:
    //   subtotal × (1 - shopCommissionRate)   — food revenue minus our commission.
    // Tax, delivery fee, service fee, and tip stay on the platform balance:
    //   - tax is held in the segregated escrow and remitted to the Texas Comptroller
    //   - tip is paid out to the driver in the weekly payout batch (100% pass-through)
    //   - delivery fee + service fee + commission fund driver base/mileage and platform ops
    // Stripe processing fees are deducted from the platform balance, so the shop's
    // payout is unaffected by them (platform absorbs Stripe fees per spec §5).
    const shopPayoutCents = Math.round(subtotal * (1 - shopCommissionRate) * 100)
    const totalCents = Math.round(total * 100)
    const applicationFeeCents = totalCents - shopPayoutCents

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || 'https://donutdash.app'
    const stripe = getStripe()

    // Build line items for Stripe Checkout
    const lineItems: { price_data: { currency: string; product_data: { name: string }; unit_amount: number }; quantity: number }[] = items.map(
      (item: { name: string; price: number; quantity: number }) => ({
        price_data: {
          currency: 'usd',
          product_data: { name: item.name },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      })
    )

    // Add tax
    if (tax > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: 'Sales Tax' },
          unit_amount: Math.round(tax * 100),
        },
        quantity: 1,
      })
    }

    // Add delivery fee (skipped for pickup orders)
    if (!isPickup && deliveryFee > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: 'Delivery Fee' },
          unit_amount: Math.round(deliveryFee * 100),
        },
        quantity: 1,
      })
    }

    // Add service fee
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: 'Service Fee' },
        unit_amount: Math.round(serviceFee * 100),
      },
      quantity: 1,
    })

    if (smallOrderFee > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: 'Small Order Fee' },
          unit_amount: Math.round(smallOrderFee * 100),
        },
        quantity: 1,
      })
    }

    // Add tip
    if (tipAmount > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: 'Driver Tip' },
          unit_amount: Math.round(tipAmount * 100),
        },
        quantity: 1,
      })
    }

    // Stripe metadata caps each value at 500 chars. Pack items as a tuple array
    // [menu_item_id, qty, price_cents, instructions_or_empty] to maximize density —
    // names and image_urls are looked up from dd_menu_items in the webhook.
    const itemsCompact = items.map((i: any) => [
      i.menu_item_id,
      i.quantity,
      Math.round(Number(i.price) * 100),
      (i.special_instructions || '').slice(0, 60),
    ])
    const itemsJson = JSON.stringify(itemsCompact)
    if (itemsJson.length > 480) {
      return NextResponse.json(
        { error: 'Order has too many items or instructions for one checkout. Please split into a smaller order.' },
        { status: 400 },
      )
    }

    const metadata: Record<string, string> = {
      shop_id: shopId,
      customer_id: ddUser.id,
      customer_email: (ddUser.email || '').slice(0, 200),
      customer_name: (ddUser.name || '').slice(0, 100),
      subtotal: subtotal.toString(),
      tax: tax.toString(),
      delivery_fee: deliveryFee.toString(),
      service_fee: serviceFee.toString(),
      small_order_fee: smallOrderFee.toString(),
      commission_pct: shopCommissionPct.toString(),
      tip: tipAmount.toString(),
      total: total.toString(),
      fulfillment_type: fulfillmentType,
      delivery_address: isPickup ? '' : (delivery_address || '').slice(0, 250),
      delivery_city: isPickup ? '' : (delivery_city || '').slice(0, 100),
      delivery_lat: isPickup ? '' : (deliveryLat?.toString() || ''),
      delivery_lng: isPickup ? '' : (deliveryLng?.toString() || ''),
      delivery_instructions: isPickup ? '' : (delivery_instructions || '').slice(0, 300),
      promo_code: (promoCode || '').slice(0, 50),
      promo_discount: promoDiscount.toString(),
      scheduled_for: scheduled_for || '',
      items_json: itemsJson,
    }

    // Promo discount: Stripe charges sum(line_items), so subtracting from
    // metadata `total` alone was a silent customer overcharge. Materialize
    // the discount as a one-off Stripe coupon and attach via session
    // `discounts` — Stripe deducts it from the charged amount, our
    // application_fee_amount math still nets the right shop payout.
    let stripeDiscount: { coupon: string } | undefined
    if (promoDiscount > 0) {
      const promoCents = Math.round(promoDiscount * 100)
      // Guard: a malformed promo can't exceed what we're charging
      const safePromoCents = Math.min(promoCents, totalCents - 1)
      const coupon = await stripe.coupons.create({
        amount_off: safePromoCents,
        currency: 'usd',
        duration: 'once',
        name: promo?.label?.slice(0, 40) || promoCode?.slice(0, 40) || 'Discount',
      })
      stripeDiscount = { coupon: coupon.id }
    }

    // Create Stripe Checkout Session with connected account destination
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      payment_intent_data: {
        application_fee_amount: applicationFeeCents,
        transfer_data: {
          destination: shop.stripe_account_id,
        },
      },
      metadata,
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}&stripe=1`,
      cancel_url: `${origin}/checkout`,
      ...(stripeDiscount ? { discounts: [stripeDiscount] } : {}),
    })

    return NextResponse.json({ url: session.url, sessionId: session.id })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create Stripe checkout session' },
      { status: 500 },
    )
  }
}
