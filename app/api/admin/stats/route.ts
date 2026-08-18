import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canAccessAdminPortal } from '@/lib/admin-auth'
import { resolveCommissionRate } from '@/lib/constants'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()
    const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
    if (!ddUser || !canAccessAdminPortal(ddUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Fetch all stats in parallel
    const [ordersRes, deliveriesRes, shopsRes, driversRes, usersRes] = await Promise.all([
      svc.from('dd_orders').select('id, total, subtotal, delivery_fee, service_fee, tax, tip, status, commission_pct, order_type, refund_amount, promo_discount, discount_amount, cash_discount_amount'),
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

    // Platform-revenue metrics only count delivery + pickup orders.
    // POS walk-ins (order_type='pos_walkin') never touch the platform —
    // the shop collects payment directly — so they're irrelevant to
    // commission/service-fee/delivery-fee totals.
    const validOrders = orders.filter(o =>
      o.status !== 'cancelled' && (o.order_type === 'delivery' || o.order_type === 'pickup')
    )

    // Effective amounts after partial refunds. Same proportional
    // treatment as /api/shop/earnings + /api/admin/payouts.
    const effSubtotal = (o: typeof validOrders[number]) => {
      const s = Number(o.subtotal || 0); const t = Number(o.total || 0); const r = Number(o.refund_amount || 0)
      if (r <= 0 || t <= 0) return s
      return Math.max(0, s * (1 - Math.min(r / t, 1)))
    }
    const effFee = (raw: number, o: typeof validOrders[number]) => {
      const t = Number(o.total || 0); const r = Number(o.refund_amount || 0)
      if (r <= 0 || t <= 0) return raw
      return Math.max(0, raw * (1 - Math.min(r / t, 1)))
    }

    const totalRevenue = validOrders.reduce((sum, o) => sum + (Number(o.total || 0) - Number(o.refund_amount || 0)), 0)
    const totalDeliveryFees = validOrders.reduce((sum, o) => sum + effFee(Number(o.delivery_fee || 0), o), 0)
    const totalServiceFees = validOrders.reduce((sum, o) => sum + effFee(Number(o.service_fee || 0), o), 0)
    const totalTips = validOrders.reduce((sum, o) => sum + effFee(Number(o.tip || 0), o), 0)

    // Commission earned from shops — uses each order's snapshotted rate so historical
    // orders keep the rate that was active when they were placed.
    const shopCommissions = Math.round(validOrders.reduce((sum, o) => sum + effSubtotal(o) * resolveCommissionRate(o), 0) * 100) / 100

    // Driver payouts from completed/active deliveries (not cancelled)
    const driverPayouts = deliveries
      .filter(d => d.status !== 'cancelled')
      .reduce((sum, d) => sum + (d.driver_earnings || 0), 0)

    // Promo codes / discounts are platform-funded: the shop still gets its full
    // subtotal-minus-commission and the driver their full pay, but the customer
    // paid less. So the discount comes straight out of the platform's slice and
    // must be subtracted from net profit — otherwise profit is overstated by the
    // promo we handed out. (e.g. WELCOME10 knocking $1.45 off an order.)
    const platformDiscounts = Math.round(validOrders.reduce((sum, o) =>
      sum + effFee(Number(o.promo_discount || 0) + Number(o.discount_amount || 0) + Number(o.cash_discount_amount || 0), o), 0) * 100) / 100

    // Net profit = commissions + service fees + delivery fees + tips collected
    //              - driver payouts (which include tips paid out)
    //              - platform-funded discounts (promos we absorbed)
    // Tips pass through: customer paid → platform → driver. Without
    // adding tips on the revenue side, the subtraction inside
    // driverPayouts double-counts the tip pool and silently lowers
    // net profit by ~totalTips.
    const netProfit = Math.round((shopCommissions + totalServiceFees + totalDeliveryFees + totalTips - driverPayouts - platformDiscounts) * 100) / 100

    // "Money buckets" — how the cash customers paid (totalRevenue) splits by
    // who it actually belongs to. These four partition totalRevenue exactly
    // (now that netProfit absorbs platform-funded discounts):
    //   heldForShops + heldForDrivers + heldForTax + netProfit === totalRevenue
    // Only netProfit is the platform's; the other three are pass-through
    // liabilities the platform is holding until it pays them out.
    //  - Shops: food revenue minus your commission (paid via weekly payout batch)
    //  - Drivers: base + mileage + tips (paid via weekly payout batch)
    //  - Tax: sales tax collected, owed to Texas (moved via Tax Center)
    const heldForShops = Math.round(validOrders.reduce((sum, o) => sum + effSubtotal(o) * (1 - resolveCommissionRate(o)), 0) * 100) / 100
    const heldForDrivers = Math.round(driverPayouts * 100) / 100
    const heldForTax = Math.round(validOrders.reduce((sum, o) => sum + effFee(Number(o.tax || 0), o), 0) * 100) / 100

    return NextResponse.json({
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      netProfit,
      shopCommissions,
      totalServiceFees: Math.round(totalServiceFees * 100) / 100,
      totalDeliveryFees: Math.round(totalDeliveryFees * 100) / 100,
      driverPayouts: Math.round(driverPayouts * 100) / 100,
      totalTips: Math.round(totalTips * 100) / 100,
      heldForShops,
      heldForDrivers,
      heldForTax,
      platformDiscounts,
      totalOrders: validOrders.length,
      activeShops: shops.filter(s => s.is_active).length,
      activeDrivers: drivers.length,
      totalUsers: users.length,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
