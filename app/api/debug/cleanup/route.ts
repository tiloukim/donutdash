import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser || ddUser.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  // Cancel all non-delivered, non-cancelled orders
  const { data: staleOrders } = await svc
    .from('dd_orders')
    .select('id, status')
    .not('status', 'in', '("delivered","cancelled")')

  if (!staleOrders?.length) {
    return NextResponse.json({ message: 'No stale orders found', count: 0 })
  }

  const ids = staleOrders.map(o => o.id)

  // Cancel the orders
  await svc.from('dd_orders')
    .update({ status: 'cancelled' })
    .in('id', ids)

  // Cancel any pending deliveries for these orders
  await svc.from('dd_deliveries')
    .update({ status: 'cancelled' })
    .in('order_id', ids)
    .not('status', 'eq', 'delivered')

  // Expire any pending offers
  await svc.from('dd_delivery_offers')
    .update({ status: 'expired' })
    .eq('status', 'pending')

  return NextResponse.json({
    message: `Cancelled ${staleOrders.length} stale orders`,
    cancelled: staleOrders.map(o => ({ id: o.id.slice(0, 8), was: o.status })),
  })
}
