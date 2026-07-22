import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { assignNextDriver } from '@/lib/delivery-assignment'
import { quoteDriverEarnings, ensureDriverEarnings } from '@/lib/pay-config'
import { haversineDistance } from '@/lib/osrm'

// GET - get current pending offer for this driver
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'driver' && ddUser.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Clean up any expired offers for this driver (backup for cron)
  const { data: expiredOffers } = await svc
    .from('dd_delivery_offers')
    .select('id, delivery_id')
    .eq('driver_id', ddUser.id)
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString())

  if (expiredOffers?.length) {
    await svc
      .from('dd_delivery_offers')
      .update({ status: 'expired' })
      .in('id', expiredOffers.map(o => o.id))

    // Reassign each expired delivery to the next driver
    const deliveryIds = [...new Set(expiredOffers.map(o => o.delivery_id))]
    for (const deliveryId of deliveryIds) {
      assignNextDriver(deliveryId).catch(() => {})
    }
  }

  const { data: offer } = await svc
    .from('dd_delivery_offers')
    .select('*, delivery:dd_deliveries(*, order:dd_orders(*, shop:dd_shops(name, address, city, lat, lng), customer:dd_users!customer_id(name), dd_order_items(*)))')
    .eq('driver_id', ddUser.id)
    .eq('status', 'pending')
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (offer) {
    // Enrich with items
    if (offer.delivery?.order) {
      offer.delivery.order.items = offer.delivery.order.dd_order_items
    }
    // Guarantee a real earnings figure so the offer card never shows a placeholder.
    if (offer.delivery) {
      offer.delivery.driver_earnings = await ensureDriverEarnings(
        offer.delivery.id, offer.delivery.distance_miles, offer.delivery.order?.tip, offer.delivery.driver_earnings,
      )
    }
    return NextResponse.json(offer)
  }

  // No pending offer — check for unassigned deliveries and self-assign.
  // Self-claim must respect the same gates findNearestAvailableDrivers
  // enforces from the platform side: driver must be online AND not
  // already busy on another delivery.
  const { data: driverLoc } = await svc
    .from('dd_driver_locations')
    .select('lat, lng, is_online')
    .eq('driver_id', ddUser.id)
    .maybeSingle()

  if (!driverLoc?.is_online) {
    return NextResponse.json(null)
  }

  // Busy-driver gate — if this driver has an active delivery, no
  // self-claim. Mirrors the cap in findNearestAvailableDrivers.
  const { data: activeDeliveries } = await svc
    .from('dd_deliveries')
    .select('id')
    .eq('driver_id', ddUser.id)
    .in('status', ['assigned', 'picked_up', 'delivering'])
    .limit(1)
  if (activeDeliveries && activeDeliveries.length > 0) {
    return NextResponse.json(null)
  }

  if (driverLoc?.lat && driverLoc?.lng && driverLoc.lat !== 0 && driverLoc.lng !== 0) {
    const { data: unassigned } = await svc
      .from('dd_deliveries')
      .select('id, pickup_lat, pickup_lng')
      .eq('status', 'pending')
      .is('driver_id', null)

    if (unassigned?.length) {
      // Find nearest unassigned delivery within range
      for (const d of unassigned) {
        if (d.pickup_lat && d.pickup_lng) {
          const dist = haversineDistance(d.pickup_lat, d.pickup_lng, driverLoc.lat, driverLoc.lng)
          if (dist <= 10) {
            // Check this driver hasn't already been offered/declined this delivery
            const { data: prevOffer } = await svc
              .from('dd_delivery_offers')
              .select('id')
              .eq('delivery_id', d.id)
              .eq('driver_id', ddUser.id)
              .maybeSingle()

            if (!prevOffer) {
              console.log('[DRIVER OFFER] Auto-creating offer for unassigned delivery:', d.id, 'driver:', ddUser.id)
              const { createDeliveryOffer } = await import('@/lib/delivery-assignment')
              const { data: newOffer } = await createDeliveryOffer(d.id, ddUser.id)

              if (newOffer) {
                // Fetch the full offer with details
                const { data: fullOffer } = await svc
                  .from('dd_delivery_offers')
                  .select('*, delivery:dd_deliveries(*, order:dd_orders(*, shop:dd_shops(name, address, city, lat, lng), customer:dd_users!customer_id(name), dd_order_items(*)))')
                  .eq('id', newOffer.id)
                  .single()

                if (fullOffer?.delivery?.order) {
                  fullOffer.delivery.order.items = fullOffer.delivery.order.dd_order_items
                }
                if (fullOffer?.delivery) {
                  fullOffer.delivery.driver_earnings = await ensureDriverEarnings(
                    fullOffer.delivery.id, fullOffer.delivery.distance_miles, fullOffer.delivery.order?.tip, fullOffer.delivery.driver_earnings,
                  )
                }
                return NextResponse.json(fullOffer)
              }
            }
          }
        }
      }
    }
  }

  return NextResponse.json(null)
}

// POST - accept or decline offer
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'driver' && ddUser.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { offer_id, action } = await req.json()

  if (!offer_id || !['accept', 'decline'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Get the offer
  const { data: offer } = await svc
    .from('dd_delivery_offers')
    .select('*, delivery:dd_deliveries(*, order:dd_orders(*, shop:dd_shops(lat, lng)))')
    .eq('id', offer_id)
    .eq('driver_id', ddUser.id)
    .eq('status', 'pending')
    .single()

  if (!offer) {
    return NextResponse.json({ error: 'Offer not found or expired' }, { status: 404 })
  }

  if (new Date(offer.expires_at) < new Date()) {
    await svc.from('dd_delivery_offers').update({ status: 'expired' }).eq('id', offer_id)
    return NextResponse.json({ error: 'Offer has expired' }, { status: 410 })
  }

  if (action === 'decline') {
    await svc.from('dd_delivery_offers')
      .update({ status: 'declined', responded_at: new Date().toISOString() })
      .eq('id', offer_id)

    // Try to assign to next driver
    await assignNextDriver(offer.delivery_id)
    return NextResponse.json({ declined: true })
  }

  // Accept.
  // Honor the exact figure the driver was offered — accepting must not re-price
  // the delivery. If the offered amount is already set (it is, since the offer
  // GET backfills it), use it verbatim. Only compute as a fallback for a
  // delivery that somehow reached accept with no earnings.
  let earnings = offer.delivery?.driver_earnings
  if (earnings == null || earnings <= 0) {
    const shopLat = offer.delivery?.order?.shop?.lat
    const shopLng = offer.delivery?.order?.shop?.lng
    const dropLat = offer.delivery?.dropoff_lat
    const dropLng = offer.delivery?.dropoff_lng
    const tip = offer.delivery?.order?.tip || 0
    // Prefer live recompute; fall back to the saved distance_miles on the
    // delivery record, then 0 (base pay only) — never invent a 2-mile default.
    let dist = (shopLat && shopLng && dropLat && dropLng)
      ? haversineDistance(shopLat, shopLng, dropLat, dropLng)
      : (offer.delivery?.distance_miles || 0)
    if (!Number.isFinite(dist) || dist < 0) dist = 0
    earnings = await quoteDriverEarnings(dist, tip)
  }

  // Update offer
  await svc.from('dd_delivery_offers')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', offer_id)

  // Assign driver to delivery
  const { error: deliveryError } = await svc.from('dd_deliveries')
    .update({
      driver_id: ddUser.id,
      status: 'assigned',
      driver_earnings: earnings,
    })
    .eq('id', offer.delivery_id)

  if (deliveryError) {
    console.error('[OFFER ACCEPT] Failed to assign driver to delivery:', deliveryError)
    return NextResponse.json({ error: 'Failed to assign delivery' }, { status: 500 })
  }

  // Update order status
  await svc.from('dd_orders')
    .update({ status: 'confirmed' })
    .eq('id', offer.delivery?.order_id)

  return NextResponse.json({ accepted: true, delivery_id: offer.delivery_id })
}
