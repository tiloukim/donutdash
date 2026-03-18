import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { SHOP_COMMISSION_RATE } from '@/lib/constants'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: shop } = await svc.from('dd_shops').select('id').eq('owner_id', ddUser.id).single()
  if (!shop) return NextResponse.json({ error: 'No shop found' }, { status: 404 })

  // Date boundaries
  const now = new Date()

  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)

  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay()) // Sunday start
  weekStart.setHours(0, 0, 0, 0)

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const { data: allOrders } = await svc.from('dd_orders').select('id, total, status, created_at').eq('shop_id', shop.id)
  const orders = allOrders || []

  // Filter non-cancelled orders for revenue calculations
  const nonCancelled = orders.filter(o => o.status !== 'cancelled')

  function calcPeriod(filtered: typeof orders) {
    const active = filtered.filter(o => o.status !== 'cancelled')
    const totalSales = active.reduce((s, o) => s + o.total, 0)
    return {
      orderCount: filtered.length,
      totalSales,
      commission: totalSales * SHOP_COMMISSION_RATE,
      shopEarnings: totalSales * (1 - SHOP_COMMISSION_RATE),
    }
  }

  const todayOrders = orders.filter(o => new Date(o.created_at) >= todayStart)
  const weekOrders = orders.filter(o => new Date(o.created_at) >= weekStart)
  const monthOrders = orders.filter(o => new Date(o.created_at) >= monthStart)

  const pendingOrders = orders.filter(o => o.status === 'pending').length

  const { data: recentOrders } = await svc.from('dd_orders').select('*, dd_order_items(*), customer:dd_users!customer_id(name, email)').eq('shop_id', shop.id).order('created_at', { ascending: false }).limit(10)

  return NextResponse.json({
    // Legacy fields for backwards compat
    todayOrders: todayOrders.length,
    todayRevenue: todayOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0),
    pendingOrders,
    totalOrders: orders.length,
    // Period breakdowns
    today: calcPeriod(todayOrders),
    thisWeek: calcPeriod(weekOrders),
    thisMonth: calcPeriod(monthOrders),
    allTime: calcPeriod(orders),
    recentOrders: (recentOrders || []).map(o => ({ ...o, items: o.dd_order_items })),
  })
}
