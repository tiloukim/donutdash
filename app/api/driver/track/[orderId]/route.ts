import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()

  // Get the delivery for this order
  const { data: delivery } = await svc
    .from('dd_deliveries')
    .select('id, driver_id, status, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, route_polyline, estimated_duration_min')
    .eq('order_id', orderId)
    .in('status', ['assigned', 'picked_up', 'delivering'])
    .maybeSingle()

  if (!delivery || !delivery.driver_id) {
    return NextResponse.json({ error: 'No active delivery' }, { status: 404 })
  }

  // Get driver location
  const { data: location } = await svc
    .from('dd_driver_locations')
    .select('lat, lng, heading, speed, updated_at')
    .eq('driver_id', delivery.driver_id)
    .single()

  // Get driver info
  const { data: driver } = await svc
    .from('dd_users')
    .select('name, avatar_url')
    .eq('id', delivery.driver_id)
    .single()

  return NextResponse.json({
    delivery_status: delivery.status,
    driver: driver ? { name: driver.name, avatar_url: driver.avatar_url } : null,
    location: location || null,
    route_polyline: delivery.route_polyline,
    estimated_duration_min: delivery.estimated_duration_min,
  })
}
