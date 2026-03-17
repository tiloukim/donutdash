import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { assignNextDriver, calculateDriverEarnings } from '@/lib/delivery-assignment'
import { haversineDistance } from '@/lib/osrm'

// Called when a new order is confirmed to start the auto-assignment process
export async function POST(req: NextRequest) {
  const { order_id } = await req.json()
  if (!order_id) return NextResponse.json({ error: 'Missing order_id' }, { status: 400 })

  const svc = createServiceClient()

  // Get order with shop info
  const { data: order } = await svc
    .from('dd_orders')
    .select('*, shop:dd_shops(lat, lng, address, city)')
    .eq('id', order_id)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

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
    const dist = (shopLat && shopLng && dropLat && dropLng)
      ? haversineDistance(shopLat, shopLng, dropLat, dropLng) : 2
    const earnings = calculateDriverEarnings(dist, order.tip || 0)

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
        base_pay: 3.00,
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
