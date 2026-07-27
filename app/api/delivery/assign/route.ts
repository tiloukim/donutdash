import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { assignNextDriver } from '@/lib/delivery-assignment'
import { haversineDistance } from '@/lib/osrm'
import { MAX_DELIVERY_MILES } from '@/lib/constants'
import { getPayConfig } from '@/lib/pay-config'

// Called when a new order is confirmed to start the auto-assignment process.
// Triggered server-side from /api/checkout, /api/shop/orders, and the
// admin reassign flow. Restricted to admin / general / field managers and
// the owning shop_owner — without this, any signed-in user could trigger
// dispatch for any order_id they guess.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { order_id } = await req.json()
  if (!order_id) return NextResponse.json({ error: 'Missing order_id' }, { status: 400 })

  const svc = createServiceClient()

  const { data: caller } = await svc
    .from('dd_users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const isAdminOrOps = caller.role === 'admin'
    || caller.role === 'general_manager'
    || caller.role === 'field_manager'
  if (!isAdminOrOps && caller.role !== 'shop_owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (caller.role === 'shop_owner') {
    // Shop owner can only dispatch for their own shop's orders.
    const { data: orderShop } = await svc
      .from('dd_orders')
      .select('shop:dd_shops(owner_id)')
      .eq('id', order_id)
      .maybeSingle()
    const ownerId = (orderShop?.shop as { owner_id?: string } | null)?.owner_id
    if (ownerId !== caller.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Get order with shop info
  const { data: order } = await svc
    .from('dd_orders')
    .select('*, shop:dd_shops(lat, lng, address, city)')
    .eq('id', order_id)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  // Refuse to dispatch a driver for walk-in POS sales — they have no delivery
  // address, no customer, and no driver involvement. Belt-and-suspenders: nothing
  // currently calls this endpoint for walk-ins, but reject defensively in case.
  if (order.order_type === 'pos_walkin') {
    return NextResponse.json({ error: 'Walk-in POS sales cannot be assigned to a driver' }, { status: 400 })
  }

  // Create delivery record if not exists
  const { data: existing } = await svc
    .from('dd_deliveries')
    .select('id')
    .eq('order_id', order_id)
    .maybeSingle()

  let deliveryId: string

  if (existing) {
    deliveryId = existing.id
  } else {
    // Calculate estimated earnings
    const shopLat = order.shop?.lat || 0
    const shopLng = order.shop?.lng || 0
    const dropLat = order.delivery_lat || 0
    const dropLng = order.delivery_lng || 0
    // No coordinate fallback. /api/checkout requires successful geocoding
    // before an order is created, so missing coords here means data
    // corruption; pay base only rather than invent mileage.
    const dist = (shopLat && shopLng && dropLat && dropLng)
      ? haversineDistance(shopLat, shopLng, dropLat, dropLng) : 0

    if (dist > MAX_DELIVERY_MILES) {
      console.error('[DELIVERY ASSIGN] Distance exceeds maximum:', { order_id, dist, shopLat, shopLng, dropLat, dropLng })
      return NextResponse.json({ error: `Delivery distance ${dist.toFixed(1)}mi exceeds maximum ${MAX_DELIVERY_MILES}mi. Order needs admin review.` }, { status: 400 })
    }

    const cfg = await getPayConfig()
    const tip = order.tip || 0
    const earnings = Math.round((cfg.driverBasePay + dist * cfg.driverPerMile + tip) * 100) / 100

    const { data: delivery, error } = await svc
      .from('dd_deliveries')
      .insert({
        order_id,
        status: 'pending',
        pickup_lat: order.shop?.lat,
        pickup_lng: order.shop?.lng,
        dropoff_lat: order.delivery_lat,
        dropoff_lng: order.delivery_lng,
        distance_miles: dist,
        driver_earnings: earnings,
        base_pay: cfg.driverBasePay,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    deliveryId = delivery.id
  }

  // Start the offer chain
  const result = await assignNextDriver(deliveryId)

  return NextResponse.json({
    delivery_id: deliveryId,
    offer_sent: !!result?.data,
  })
}
