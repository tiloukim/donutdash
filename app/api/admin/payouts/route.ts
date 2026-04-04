import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { SHOP_COMMISSION_RATE } from '@/lib/constants'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || ddUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') || 'week' // week, month, all

  // Calculate date range
  const now = new Date()
  let startDate: string | null = null
  if (period === 'week') {
    const d = new Date(now)
    d.setDate(d.getDate() - d.getDay()) // Start of week (Sunday)
    d.setHours(0, 0, 0, 0)
    startDate = d.toISOString()
  } else if (period === 'month') {
    const d = new Date(now.getFullYear(), now.getMonth(), 1)
    startDate = d.toISOString()
  }

  // Fetch delivered orders with shop info
  let ordersQuery = svc.from('dd_orders')
    .select('id, subtotal, delivery_fee, service_fee, tip, total, shop_id, created_at, shop:dd_shops!shop_id(id, name)')
    .eq('status', 'delivered')
  if (startDate) ordersQuery = ordersQuery.gte('created_at', startDate)
  const { data: orders } = await ordersQuery

  // Fetch completed deliveries with driver info
  let deliveriesQuery = svc.from('dd_deliveries')
    .select('id, order_id, driver_id, driver_earnings, base_pay, distance_miles, delivered_at, driver:dd_users!driver_id(id, name, phone, email)')
    .eq('status', 'delivered')
  if (startDate) deliveriesQuery = deliveriesQuery.gte('delivered_at', startDate)
  const { data: deliveries } = await deliveriesQuery

  // Aggregate shop payouts
  const shopMap = new Map<string, { name: string; orders: number; subtotal: number; commission: number; payout: number }>()
  for (const order of orders || []) {
    const shopId = order.shop_id
    const shopName = (order.shop as any)?.name || 'Unknown Shop'
    const existing = shopMap.get(shopId) || { name: shopName, orders: 0, subtotal: 0, commission: 0, payout: 0 }
    existing.orders += 1
    existing.subtotal += Number(order.subtotal || 0)
    const commission = Number(order.subtotal || 0) * SHOP_COMMISSION_RATE
    existing.commission += commission
    existing.payout += Number(order.subtotal || 0) - commission
    shopMap.set(shopId, existing)
  }

  // Aggregate driver payouts (same calculation as driver earnings API)
  const driverMap = new Map<string, { name: string; phone: string; email: string; deliveries: number; earnings: number; tips: number; basePay: number }>()
  for (const del of deliveries || []) {
    const driverId = del.driver_id
    if (!driverId) continue
    const driver = del.driver as any
    const existing = driverMap.get(driverId) || { name: driver?.name || 'Unknown', phone: driver?.phone || '', email: driver?.email || '', deliveries: 0, earnings: 0, tips: 0, basePay: 0 }
    existing.deliveries += 1
    // Match driver earnings calculation: max of stored vs calculated
    const basePay = Number(del.base_pay || 3.00)
    const order = (orders || []).find(o => o.id === del.order_id)
    const tip = Number(order?.tip || 0)
    const distanceMiles = del.distance_miles || 2
    const storedEarnings = Number(del.driver_earnings || 4.00)
    const calculatedEarnings = basePay + (distanceMiles * 0.55) + tip
    const actualEarnings = Math.max(storedEarnings, Math.round(calculatedEarnings * 100) / 100)
    existing.earnings += actualEarnings
    existing.basePay += basePay
    existing.tips += tip
    driverMap.set(driverId, existing)
  }

  const shopPayouts = Array.from(shopMap.entries()).map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.payout - a.payout)

  const driverPayouts = Array.from(driverMap.entries()).map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.earnings - a.earnings)

  const totalShopPayouts = shopPayouts.reduce((sum, s) => sum + s.payout, 0)
  const totalDriverPayouts = driverPayouts.reduce((sum, d) => sum + d.earnings, 0)
  const totalRevenue = (orders || []).reduce((sum, o) => sum + Number(o.total || 0), 0)
  const totalCommissions = shopPayouts.reduce((sum, s) => sum + s.commission, 0)
  const totalServiceFees = (orders || []).reduce((sum, o) => sum + Number(o.service_fee || 0), 0)
  const totalDeliveryFees = (orders || []).reduce((sum, o) => sum + Number(o.delivery_fee || 0), 0)
  const platformProfit = totalCommissions + totalServiceFees + totalDeliveryFees - totalDriverPayouts

  return NextResponse.json({
    period,
    startDate,
    summary: {
      totalRevenue,
      totalShopPayouts,
      totalDriverPayouts,
      totalCommissions,
      totalServiceFees,
      totalDeliveryFees,
      platformProfit,
      totalOrders: (orders || []).length,
    },
    shopPayouts,
    driverPayouts,
  })
}
