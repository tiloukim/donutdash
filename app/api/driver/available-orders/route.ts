import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createDeliveryOffer } from '@/lib/delivery-assignment'

export const dynamic = 'force-dynamic'

// GET — fetch unassigned deliveries for drivers to pick up
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Find deliveries with no driver assigned (pending status)
  const { data: unassigned } = await svc.from('dd_deliveries')
    .select('id, order_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, distance_miles, driver_earnings, created_at, order:dd_orders(id, total, tip, subtotal, delivery_address, delivery_city, shop:dd_shops(name, address, city))')
    .is('driver_id', null)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  return NextResponse.json({ deliveries: unassigned || [] })
}

// POST — driver claims an available delivery
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { delivery_id } = await req.json()
  if (!delivery_id) return NextResponse.json({ error: 'delivery_id required' }, { status: 400 })

  // Verify the delivery is still unassigned
  const { data: delivery } = await svc.from('dd_deliveries')
    .select('id, driver_id, status, order_id, driver_earnings, order:dd_orders(tip)')
    .eq('id', delivery_id)
    .single()

  if (!delivery) return NextResponse.json({ error: 'Delivery not found' }, { status: 404 })
  if (delivery.driver_id) return NextResponse.json({ error: 'Already claimed by another driver' }, { status: 400 })

  // Check driver isn't already busy
  const { data: busy } = await svc.from('dd_deliveries')
    .select('id')
    .eq('driver_id', ddUser.id)
    .in('status', ['assigned', 'picked_up', 'delivering'])
    .limit(1)

  if (busy && busy.length > 0) {
    return NextResponse.json({ error: 'You already have an active delivery' }, { status: 400 })
  }

  // Assign to this driver
  const { error: updateErr } = await svc.from('dd_deliveries')
    .update({ driver_id: ddUser.id, status: 'assigned' })
    .eq('id', delivery_id)
    .is('driver_id', null) // race condition guard

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Update order status to confirmed
  await svc.from('dd_orders')
    .update({ status: 'confirmed' })
    .eq('id', delivery.order_id)

  return NextResponse.json({ success: true, message: 'Delivery accepted!' })
}
