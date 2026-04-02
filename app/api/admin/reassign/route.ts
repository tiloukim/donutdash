import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { assignNextDriver } from '@/lib/delivery-assignment'

export const dynamic = 'force-dynamic'

// POST — reassign a stuck order to available drivers
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || ddUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { order_id } = await req.json()
  if (!order_id) return NextResponse.json({ error: 'order_id required' }, { status: 400 })

  // Find the delivery for this order
  const { data: delivery } = await svc.from('dd_deliveries')
    .select('id, driver_id, status')
    .eq('order_id', order_id)
    .single()

  if (!delivery) {
    // No delivery record yet — create one and assign
    const { data: order } = await svc.from('dd_orders')
      .select('id, shop_id, delivery_lat, delivery_lng, tip, shop:dd_shops(lat, lng)')
      .eq('id', order_id)
      .single()

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const shopLat = (order.shop as any)?.lat
    const shopLng = (order.shop as any)?.lng
    const dropLat = order.delivery_lat
    const dropLng = order.delivery_lng

    // Create delivery record
    const { data: newDelivery, error: delErr } = await svc.from('dd_deliveries').insert({
      order_id: order.id,
      status: 'pending',
      pickup_lat: shopLat,
      pickup_lng: shopLng,
      dropoff_lat: dropLat,
      dropoff_lng: dropLng,
    }).select().single()

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

    const result = await assignNextDriver(newDelivery.id)
    if (result?.data) {
      return NextResponse.json({ success: true, message: 'Delivery created and offered to nearest driver' })
    }
    return NextResponse.json({ success: false, message: 'No online drivers available nearby' }, { status: 200 })
  }

  // Delivery exists but has no driver (stuck)
  if (delivery.driver_id && ['assigned', 'picked_up', 'delivering'].includes(delivery.status)) {
    return NextResponse.json({ error: 'Order already has an active driver' }, { status: 400 })
  }

  // Clear all previous expired/declined offers so we can retry all drivers
  await svc.from('dd_delivery_offers')
    .delete()
    .eq('delivery_id', delivery.id)
    .in('status', ['expired', 'declined'])

  // Cancel any pending offers
  await svc.from('dd_delivery_offers')
    .update({ status: 'expired' })
    .eq('delivery_id', delivery.id)
    .eq('status', 'pending')

  // Reset delivery to pending with no driver
  await svc.from('dd_deliveries')
    .update({ driver_id: null, status: 'pending' })
    .eq('id', delivery.id)

  // Reset order status to pending
  await svc.from('dd_orders')
    .update({ status: 'pending' })
    .eq('id', order_id)

  // Try assigning again
  const result = await assignNextDriver(delivery.id)
  if (result?.data) {
    return NextResponse.json({ success: true, message: 'Order re-offered to nearest available driver' })
  }
  return NextResponse.json({ success: true, message: 'No online drivers available nearby. Order is back in queue and will auto-assign when a driver comes online.' })
}
