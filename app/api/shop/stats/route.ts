import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: shop } = await svc.from('dd_shops').select('id').eq('owner_id', ddUser.id).single()
  if (!shop) return NextResponse.json({ error: 'No shop found' }, { status: 404 })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: allOrders } = await svc.from('dd_orders').select('id, total, status, created_at').eq('shop_id', shop.id)
  const orders = allOrders || []

  const todayOrders = orders.filter(o => new Date(o.created_at) >= today)
  const todayRevenue = todayOrders.reduce((s, o) => s + (o.status !== 'cancelled' ? o.total : 0), 0)
  const pendingOrders = orders.filter(o => o.status === 'pending').length

  const { data: recentOrders } = await svc.from('dd_orders').select('*, dd_order_items(*), customer:dd_users!customer_id(name, email)').eq('shop_id', shop.id).order('created_at', { ascending: false }).limit(10)

  return NextResponse.json({
    todayOrders: todayOrders.length,
    todayRevenue,
    pendingOrders,
    totalOrders: orders.length,
    recentOrders: (recentOrders || []).map(o => ({ ...o, items: o.dd_order_items })),
  })
}
