import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'driver' && ddUser.role !== 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { delivery_id, status } = await req.json()

  const validTransitions: Record<string, string[]> = {
    assigned: ['picked_up'],
    picked_up: ['delivering'],
    delivering: ['delivered'],
  }

  // Get current delivery
  const { data: delivery } = await svc.from('dd_deliveries')
    .select('*')
    .eq('id', delivery_id)
    .eq('driver_id', ddUser.id)
    .single()

  if (!delivery) return NextResponse.json({ error: 'Delivery not found' }, { status: 404 })

  const allowed = validTransitions[delivery.status] || []
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: `Cannot transition from ${delivery.status} to ${status}` }, { status: 400 })
  }

  const updateData: any = { status }
  if (status === 'picked_up') updateData.picked_up_at = new Date().toISOString()
  if (status === 'delivered') updateData.delivered_at = new Date().toISOString()

  const { data: updated, error } = await svc.from('dd_deliveries')
    .update(updateData)
    .eq('id', delivery_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sync order status
  const orderStatusMap: Record<string, string> = {
    picked_up: 'picked_up',
    delivering: 'out_for_delivery',
    delivered: 'delivered',
  }

  if (orderStatusMap[status]) {
    await svc.from('dd_orders')
      .update({ status: orderStatusMap[status], updated_at: new Date().toISOString() })
      .eq('id', delivery.order_id)
  }

  return NextResponse.json(updated)
}
