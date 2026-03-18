import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { SHOP_COMMISSION_RATE } from '@/lib/constants'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()
    const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
    if (!ddUser || ddUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Fetch all stats in parallel
    const [ordersRes, deliveriesRes, shopsRes, driversRes, usersRes] = await Promise.all([
      svc.from('dd_orders').select('id, total, subtotal, delivery_fee, service_fee, tip, status'),
      svc.from('dd_deliveries').select('id, driver_earnings, status'),
      svc.from('dd_shops').select('id, is_active'),
      svc.from('dd_users').select('id').eq('role', 'driver').eq('is_active', true),
      svc.from('dd_users').select('id'),
    ])

    const orders = ordersRes.data || []
    const deliveries = deliveriesRes.data || []
    const shops = shopsRes.data || []
    const drivers = driversRes.data || []
    const users = usersRes.data || []

    // Only count non-cancelled orders for financial metrics
    const validOrders = orders.filter(o => o.status !== 'cancelled')

    const totalRevenue = validOrders.reduce((sum, o) => sum + (o.total || 0), 0)
    const totalSubtotal = validOrders.reduce((sum, o) => sum + (o.subtotal || 0), 0)
    const totalDeliveryFees = validOrders.reduce((sum, o) => sum + (o.delivery_fee || 0), 0)
    const totalServiceFees = validOrders.reduce((sum, o) => sum + (o.service_fee || 0), 0)
    const totalTips = validOrders.reduce((sum, o) => sum + (o.tip || 0), 0)

    // Commission earned from shops (percentage of food subtotals)
    const shopCommissions = Math.round(totalSubtotal * SHOP_COMMISSION_RATE * 100) / 100

    // Driver payouts from completed/active deliveries (not cancelled)
    const driverPayouts = deliveries
      .filter(d => d.status !== 'cancelled')
      .reduce((sum, d) => sum + (d.driver_earnings || 0), 0)

    // Net profit = commissions + service fees + delivery fees - driver payouts
    // Tips pass through to drivers and are not platform revenue
    const netProfit = Math.round((shopCommissions + totalServiceFees + totalDeliveryFees - driverPayouts) * 100) / 100

    return NextResponse.json({
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      netProfit,
      shopCommissions,
      totalServiceFees: Math.round(totalServiceFees * 100) / 100,
      totalDeliveryFees: Math.round(totalDeliveryFees * 100) / 100,
      driverPayouts: Math.round(driverPayouts * 100) / 100,
      totalTips: Math.round(totalTips * 100) / 100,
      totalOrders: orders.length,
      activeShops: shops.filter(s => s.is_active).length,
      activeDrivers: drivers.length,
      totalUsers: users.length,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
