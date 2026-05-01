import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getStripe, PLATFORM_FEE_RATE } from '@/lib/stripe'
import { SERVICE_FEE_RATE, DEFAULT_DELIVERY_FEE, MAX_DELIVERY_MILES } from '@/lib/constants'
import { haversineDistance } from '@/lib/osrm'
import { isShopOpen } from '@/lib/shop-hours'
import { checkRateLimit } from '@/lib/rate-limit'

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

    const { allowed } = checkRateLimit(`stripe-checkout:${ddUser.id}`, 10, 60000)
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

    // Fetch shop info
    const svc = createServiceClient()
    const { data: shop } = await svc
      .from('dd_shops')
      .select('name, service_fee_pct, delivery_fee, min_order, tax_rate, lat, lng, owner_id, paused, pause_reason, pause_until, stripe_account_id, stripe_onboarding_complete')
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
    const shopTaxRate = shop.tax_rate ? shop.tax_rate / 100 : 0

    // Geocode delivery address
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
    const deliveryFee = shop.delivery_fee ?? DEFAULT_DELIVERY_FEE

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

    // Platform fee: 15% of the food subtotal (in cents)
    const platformFeeCents = Math.round(subtotal * PLATFORM_FEE_RATE * 100)
    const totalCents = Math.round(total * 100)

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

    // Add delivery fee
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: 'Delivery Fee' },
        unit_amount: Math.round(deliveryFee * 100),
      },
      quantity: 1,
    })

    // Add service fee
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: 'Service Fee' },
        unit_amount: Math.round(serviceFee * 100),
      },
      quantity: 1,
    })

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

    // Build metadata to reconstruct the order in the webhook
    const metadata: Record<string, string> = {
      shop_id: shopId,
      customer_id: ddUser.id,
      customer_email: ddUser.email || '',
      customer_name: ddUser.name || '',
      subtotal: subtotal.toString(),
      tax: tax.toString(),
      delivery_fee: deliveryFee.toString(),
      service_fee: serviceFee.toString(),
      tip: tipAmount.toString(),
      total: total.toString(),
      delivery_address,
      delivery_city: delivery_city || '',
      delivery_lat: deliveryLat?.toString() || '',
      delivery_lng: deliveryLng?.toString() || '',
      delivery_instructions: delivery_instructions || '',
      promo_code: promo_code || '',
      promo_discount: promoDiscount.toString(),
      scheduled_for: scheduled_for || '',
      items_json: JSON.stringify(items.map((i: any) => ({
        menu_item_id: i.menu_item_id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        special_instructions: i.special_instructions || null,
      }))),
    }

    // Create Stripe Checkout Session with connected account destination
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      payment_intent_data: {
        application_fee_amount: platformFeeCents,
        transfer_data: {
          destination: shop.stripe_account_id,
        },
      },
      metadata,
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}&stripe=1`,
      cancel_url: `${origin}/checkout`,
      ...(promoDiscount > 0 ? {
        discounts: [],
        // Apply discount via adjusting total — Stripe doesn't have inline discounts
        // so we already subtracted promoDiscount from total above
      } : {}),
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
