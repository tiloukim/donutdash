import { BASE_DELIVERY_PAY, PER_MILE_PAY, resolveCommissionRate, isPayoutExcluded } from '@/lib/constants'

/**
 * The Mon–Sun window the weekly payout batch covers, and what it will pay.
 *
 * Extracted so the Sunday-night funding reminder and the Monday payout cron
 * quote the same number. Two copies of this arithmetic would drift, and the
 * failure mode is the operator wiring the wrong amount into the bank.
 */

export interface PayoutWindow {
  weekStart: Date
  weekEnd: Date
  weekStartStr: string
  weekEndStr: string
}

/** Previous Mon 00:00 → Sun 23:59:59.999, relative to `now`. */
export function previousWeekWindow(now = new Date()): PayoutWindow {
  const dayOfWeek = now.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() + mondayOffset - 7)
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)
  return {
    weekStart,
    weekEnd,
    weekStartStr: weekStart.toISOString().split('T')[0],
    weekEndStr: weekEnd.toISOString().split('T')[0],
  }
}

export interface PayoutTotals {
  driverEarnings: Map<string, { amount: number; deliveries: number; basePay: number; tips: number }>
  shopEarnings: Map<string, { amount: number; orders: number; subtotal: number; commission: number }>
  totalDriverPayouts: number
  totalShopPayouts: number
  totalAmount: number
}

/**
 * What the batch for `window` would pay. Read-only — writes nothing.
 *
 * Mirrors the weekly-payout cron exactly, including its known imperfection:
 * shops aggregate by orders.created_at while drivers aggregate by
 * deliveries.delivered_at, so an order created late Sunday and delivered on
 * Monday splits across two batches.
 */
export async function computeWeeklyPayouts(
  svc: any,
  window: PayoutWindow,
): Promise<PayoutTotals> {
  const { data: orders } = await svc.from('dd_orders')
    .select('id, subtotal, total, refund_amount, shop_id, tip, status, commission_pct')
    .eq('status', 'delivered')
    .in('order_type', ['delivery', 'pickup'])
    .gte('created_at', window.weekStart.toISOString())
    .lte('created_at', window.weekEnd.toISOString())

  const { data: deliveries } = await svc.from('dd_deliveries')
    .select('id, order_id, driver_id, driver_earnings, base_pay, distance_miles, delivered_at, order:dd_orders(tip)')
    .eq('status', 'delivered')
    .gte('delivered_at', window.weekStart.toISOString())
    .lte('delivered_at', window.weekEnd.toISOString())

  const { data: allUsers } = await svc.from('dd_users')
    .select('id, email, role')
    .in('role', ['driver', 'shop_owner'])
  const { data: shops } = await svc.from('dd_shops').select('id, owner_id')

  const userMap = new Map<string, { id: string; email: string | null; role: string }>(
    (allUsers || []).map((u: any) => [u.id, u]),
  )
  const shopsById = new Map<string, { id: string; owner_id: string | null }>(
    (shops || []).map((s: any) => [s.id, s]),
  )

  const driverEarnings: PayoutTotals['driverEarnings'] = new Map()
  for (const del of deliveries || []) {
    if (!del.driver_id) continue
    if (isPayoutExcluded(userMap.get(del.driver_id)?.email)) continue
    const stored = Number(del.driver_earnings) || 0
    const tip = Number(del.order?.tip) || 0
    const basePay = Number(del.base_pay) || BASE_DELIVERY_PAY
    const distanceMiles = Number(del.distance_miles) || 0
    const earnings = stored > 0
      ? stored
      : Math.round((basePay + distanceMiles * PER_MILE_PAY + tip) * 100) / 100
    const cur = driverEarnings.get(del.driver_id) || { amount: 0, deliveries: 0, basePay: 0, tips: 0 }
    cur.amount += earnings
    cur.deliveries += 1
    cur.basePay += basePay
    cur.tips += tip
    driverEarnings.set(del.driver_id, cur)
  }

  const shopEarnings: PayoutTotals['shopEarnings'] = new Map()
  for (const order of orders || []) {
    const shopId = order.shop_id
    const ownerId = shopsById.get(shopId)?.owner_id
    if (isPayoutExcluded(ownerId ? userMap.get(ownerId)?.email : null)) continue
    const subtotal = Number(order.subtotal || 0)
    const total = Number(order.total || 0)
    const refund = Number(order.refund_amount || 0)
    const refundRatio = refund > 0 && total > 0 ? Math.min(refund / total, 1) : 0
    const effSub = Math.max(0, subtotal * (1 - refundRatio))
    const commission = effSub * resolveCommissionRate(order)
    const cur = shopEarnings.get(shopId) || { amount: 0, orders: 0, subtotal: 0, commission: 0 }
    cur.amount += effSub - commission
    cur.orders += 1
    cur.subtotal += effSub
    cur.commission += commission
    shopEarnings.set(shopId, cur)
  }

  const totalDriverPayouts = Array.from(driverEarnings.values()).reduce((s, d) => s + d.amount, 0)
  const totalShopPayouts = Array.from(shopEarnings.values()).reduce((s, d) => s + d.amount, 0)
  return {
    driverEarnings,
    shopEarnings,
    totalDriverPayouts,
    totalShopPayouts,
    totalAmount: Math.round((totalDriverPayouts + totalShopPayouts) * 100) / 100,
  }
}
