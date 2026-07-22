import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createDeliveryOffer } from '@/lib/delivery-assignment'
import { ensureDriverEarnings } from '@/lib/pay-config'

export const dynamic = 'force-dynamic'

// GET — fetch unassigned deliveries for drivers to pick up
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role, driver_status').eq('auth_id', user.id).single()
  if (!ddUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (ddUser.role !== 'driver' && ddUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (ddUser.role === 'driver' && ddUser.driver_status !== 'approved') {
    return NextResponse.json({ deliveries: [] })
  }

  // Find deliveries with no driver assigned (pending status)
  const { data: unassigned } = await svc.from('dd_deliveries')
    .select('id, order_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, distance_miles, driver_earnings, created_at, order:dd_orders(id, total, tip, subtotal, delivery_address, delivery_city, shop:dd_shops(name, address, city))')
    .is('driver_id', null)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  // Backfill any missing driver_earnings so the offer never shows a placeholder.
  const deliveries = await Promise.all((unassigned || []).map(async d => {
    const tip = (d.order as { tip?: number } | null)?.tip
    const driver_earnings = await ensureDriverEarnings(d.id, d.distance_miles, tip, d.driver_earnings)
    return { ...d, driver_earnings }
  }))

  return NextResponse.json({ deliveries })
}

// POST — driver claims an available delivery
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role, driver_status, name, phone').eq('auth_id', user.id).single()
  if (!ddUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (ddUser.role !== 'driver' && ddUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (ddUser.role === 'driver' && ddUser.driver_status !== 'approved') {
    return NextResponse.json({ error: 'Driver account is not approved for deliveries' }, { status: 403 })
  }

  const { delivery_id } = await req.json()
  if (!delivery_id) return NextResponse.json({ error: 'delivery_id required' }, { status: 400 })

  // Verify the delivery is still unassigned
  const { data: delivery } = await svc.from('dd_deliveries')
    .select('id, driver_id, status, order_id, distance_miles, driver_earnings, order:dd_orders(tip)')
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

  // Assign to this driver. Use .select() and verify exactly one row
  // updated — the previous .is('driver_id', null) guard quietly
  // filtered the update to zero rows on a race, returned success,
  // then bumped the order to 'confirmed' for a delivery this driver
  // doesn't actually own.
  const { data: updatedRows, error: updateErr } = await svc.from('dd_deliveries')
    // Denormalize name/phone so the POS can show the driver without reading
    // dd_users (RLS-blocked for the cashier session).
    .update({ driver_id: ddUser.id, driver_name: ddUser.name ?? null, driver_phone: ddUser.phone ?? null, status: 'assigned' })
    .eq('id', delivery_id)
    .is('driver_id', null)
    .select('id')

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.json({ error: 'Already claimed by another driver' }, { status: 409 })
  }

  // Guarantee earnings are set for the claimed delivery (this path never
  // computed them, so a null would leave the active screen showing a placeholder).
  const tip = (delivery.order as { tip?: number } | null)?.tip
  await ensureDriverEarnings(delivery_id, delivery.distance_miles, tip, delivery.driver_earnings)

  // Update order status to confirmed
  await svc.from('dd_orders')
    .update({ status: 'confirmed' })
    .eq('id', delivery.order_id)

  return NextResponse.json({ success: true, message: 'Delivery accepted!' })
}
