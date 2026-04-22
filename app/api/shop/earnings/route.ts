import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const COMMISSION_RATE = 0.15

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin'))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: shop } = await svc.from('dd_shops').select('id, stripe_account_id').eq('owner_id', ddUser.id).single()
  if (!shop) return NextResponse.json({ error: 'No shop' }, { status: 404 })

  const now = new Date()

  // Today: start of day in UTC
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

  // This week: start of most recent Monday (or Sunday — use Sunday for simplicity)
  const dayOfWeek = now.getDay()
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek)
  const weekStartStr = weekStart.toISOString()

  // This month: start of month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // 30 days ago
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // 4 weeks ago (28 days)
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch all non-cancelled orders from last 30 days in one query
  const { data: orders, error } = await svc
    .from('dd_orders')
    .select('id, created_at, status, subtotal, total, dd_order_items(id)')
    .eq('shop_id', shop.id)
    .neq('status', 'cancelled')
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const allOrders = orders || []

  // Helper
  const sumSubtotals = (list: typeof allOrders) =>
    list.reduce((sum, o) => sum + Number(o.subtotal || 0), 0)

  // Today
  const todayOrders = allOrders.filter(o => o.created_at >= todayStart)
  const todaySales = sumSubtotals(todayOrders)

  // This week
  const weekOrders = allOrders.filter(o => o.created_at >= weekStartStr)
  const weekSales = sumSubtotals(weekOrders)

  // This month
  const monthOrders = allOrders.filter(o => o.created_at >= monthStart)
  const monthSales = sumSubtotals(monthOrders)

  // Recent orders (last 30, with item count)
  const recentOrders = allOrders.slice(0, 30).map(o => {
    const subtotal = Number(o.subtotal || 0)
    const fee = Math.round(subtotal * COMMISSION_RATE * 100) / 100
    const earnings = Math.round((subtotal - fee) * 100) / 100
    return {
      id: o.id,
      created_at: o.created_at,
      status: o.status,
      subtotal,
      fee,
      earnings,
      item_count: Array.isArray(o.dd_order_items) ? o.dd_order_items.length : 0,
    }
  })

  // Weekly totals (last 4 weeks)
  const weeklyTotals: { weekLabel: string; total: number; earnings: number }[] = []
  for (let w = 3; w >= 0; w--) {
    const wStart = new Date(now.getTime() - (w + 1) * 7 * 24 * 60 * 60 * 1000)
    const wEnd = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000)
    const wStartStr = wStart.toISOString()
    const wEndStr = wEnd.toISOString()
    const weekOrdersFiltered = allOrders.filter(o => o.created_at >= wStartStr && o.created_at < wEndStr)
    const total = sumSubtotals(weekOrdersFiltered)
    const earnings = Math.round(total * (1 - COMMISSION_RATE) * 100) / 100
    const label = `${wStart.getMonth() + 1}/${wStart.getDate()}`
    weeklyTotals.push({ weekLabel: label, total: Math.round(total * 100) / 100, earnings })
  }

  // Next payout estimate (pending/delivered orders not yet in a completed payout cycle)
  const pendingPayoutOrders = allOrders.filter(o =>
    ['confirmed', 'preparing', 'ready_for_pickup', 'delivered', 'completed'].includes(o.status)
  )
  const pendingPayoutTotal = sumSubtotals(pendingPayoutOrders)
  const nextPayout = Math.round(pendingPayoutTotal * (1 - COMMISSION_RATE) * 100) / 100

  return NextResponse.json({
    today: {
      sales: Math.round(todaySales * 100) / 100,
      earnings: Math.round(todaySales * (1 - COMMISSION_RATE) * 100) / 100,
      orderCount: todayOrders.length,
    },
    thisWeek: {
      sales: Math.round(weekSales * 100) / 100,
      earnings: Math.round(weekSales * (1 - COMMISSION_RATE) * 100) / 100,
      orderCount: weekOrders.length,
    },
    thisMonth: {
      sales: Math.round(monthSales * 100) / 100,
      earnings: Math.round(monthSales * (1 - COMMISSION_RATE) * 100) / 100,
      orderCount: monthOrders.length,
    },
    nextPayout,
    stripeConnected: !!shop.stripe_account_id,
    recentOrders,
    weeklyTotals,
  })
}
