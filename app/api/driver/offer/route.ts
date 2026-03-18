import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { assignNextDriver, calculateDriverEarnings } from '@/lib/delivery-assignment'
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

  if (!offer) return NextResponse.json(null)

  // Enrich with items
  if (offer.delivery?.order) {
    offer.delivery.order.items = offer.delivery.order.dd_order_items
  }

  return NextResponse.json(offer)
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

  // Accept
  // Calculate earnings based on distance + tip
  const shopLat = offer.delivery?.order?.shop?.lat
  const shopLng = offer.delivery?.order?.shop?.lng
  const dropLat = offer.delivery?.dropoff_lat
  const dropLng = offer.delivery?.dropoff_lng
  const tip = offer.delivery?.order?.tip || 0
  let dist = offer.delivery?.distance_miles || 2 // default 2 miles
  if (shopLat && shopLng && dropLat && dropLng) {
    dist = haversineDistance(shopLat, shopLng, dropLat, dropLng)
  }
  const earnings = calculateDriverEarnings(dist, tip)

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
