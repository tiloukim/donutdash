import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { assignNextDriver, calculateDriverEarnings } from '@/lib/delivery-assignment'
import { haversineDistance } from '@/lib/osrm'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { order_id } = await req.json()
    if (!order_id) return NextResponse.json({ error: 'Missing order_id' }, { status: 400 })

    const svc = createServiceClient()

    // Get order
    const { data: order } = await svc
      .from('dd_orders')
      .select('*, shop:dd_shops(lat, lng)')
      .eq('id', order_id)
      .single()

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    // Only confirm if still pending (idempotent - don't re-confirm)
    if (order.status === 'pending') {
      await svc.from('dd_orders')
        .update({ status: 'confirmed', updated_at: new Date().toISOString() })
        .eq('id', order_id)
    }

    // Check if delivery record already exists
    const { data: existing } = await svc
      .from('dd_deliveries')
      .select('id')
      .eq('order_id', order_id)
      .maybeSingle()

    let deliveryId: string

    if (existing) {
      deliveryId = existing.id
    } else {
      // Calculate distance and earnings
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

    // Start auto-assignment - find nearest driver and send offer
    const result = await assignNextDriver(deliveryId)

    return NextResponse.json({
      confirmed: true,
      delivery_id: deliveryId,
      driver_offer_sent: !!result?.data,
    })
  } catch (err) {
    console.error('Confirm error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to confirm' }, { status: 500 })
  }
}
