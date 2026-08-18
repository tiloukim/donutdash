import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerShop as getActiveShop } from '@/lib/shop-auth'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const shop = await getActiveShop(svc, ddUser.id)
  if (!shop) return NextResponse.json({ error: 'No shop found' }, { status: 404 })

  // Get all non-cancelled orders with items
  const { data: orders } = await svc
    .from('dd_orders')
    .select('id, total, subtotal, customer_id, created_at, status, dd_order_items(name, quantity, price)')
    .eq('shop_id', shop.id)
    .neq('status', 'cancelled')

  const allOrders = orders || []

  // --- Popular Items: top 10 by order count ---
  const itemMap = new Map<string, { name: string; count: number; revenue: number }>()
  for (const order of allOrders) {
    for (const item of (order.dd_order_items || [])) {
      const key = item.name
      const existing = itemMap.get(key) || { name: key, count: 0, revenue: 0 }
      existing.count += item.quantity
      existing.revenue += item.price * item.quantity
      itemMap.set(key, existing)
    }
  }
  const popularItems = [...itemMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // --- Peak Hours: order count by hour of day ---
  const peakHours: number[] = new Array(24).fill(0)
  for (const order of allOrders) {
    const hour = new Date(order.created_at).getHours()
    peakHours[hour]++
  }

  // --- Daily Trend: last 30 days ---
  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(now.getDate() - 30)

  const dailyMap = new Map<string, { orders: number; revenue: number }>()
  // Pre-fill last 30 days
  for (let i = 0; i < 30; i++) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    dailyMap.set(key, { orders: 0, revenue: 0 })
  }
  for (const order of allOrders) {
    const key = new Date(order.created_at).toISOString().slice(0, 10)
    if (dailyMap.has(key)) {
      const entry = dailyMap.get(key)!
      entry.orders++
      entry.revenue += order.total
    }
  }
  const dailyTrend = [...dailyMap.entries()]
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // --- Key Metrics ---
  const totalRevenue = allOrders.reduce((s, o) => s + o.total, 0)
  const avgOrderValue = allOrders.length > 0 ? totalRevenue / allOrders.length : 0

  // Repeat customer rate
  const customerOrderCounts = new Map<string, number>()
  for (const order of allOrders) {
    if (order.customer_id) {
      customerOrderCounts.set(order.customer_id, (customerOrderCounts.get(order.customer_id) || 0) + 1)
    }
  }
  const totalCustomers = customerOrderCounts.size
  const repeatCustomers = [...customerOrderCounts.values()].filter(c => c >= 2).length
  const repeatCustomerRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0

  return NextResponse.json({
    popularItems,
    peakHours,
    dailyTrend,
    avgOrderValue: Math.round(avgOrderValue * 100) / 100,
    repeatCustomerRate: Math.round(repeatCustomerRate * 10) / 10,
    totalCustomers,
    totalOrders: allOrders.length,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
  })
}
