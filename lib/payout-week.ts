import { BASE_DELIVERY_PAY, PER_MILE_PAY, resolveCommissionRate, isDriverPayoutExcluded } from '@/lib/constants'

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

  // Only drivers: the shop-owner half of this lookup existed to drive the
  // shop payout exclusion, which no longer exists.
  const { data: allUsers } = await svc.from('dd_users')
    .select('id, email, role')
    .eq('role', 'driver')

  const userMap = new Map<string, { id: string; email: string | null; role: string }>(
    (allUsers || []).map((u: any) => [u.id, u]),
  )

  const driverEarnings: PayoutTotals['driverEarnings'] = new Map()
  for (const del of deliveries || []) {
    if (!del.driver_id) continue
    if (isDriverPayoutExcluded(userMap.get(del.driver_id)?.email)) continue
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

export interface BatchReadySummary {
  weekStartStr: string
  weekEndStr: string
  shopCount: number
  driverCount: number
  totalShopPayouts: number
  totalDriverPayouts: number
  totalAmount: number
}

/**
 * Tell the admins a batch is ready, broken out by shop and driver.
 *
 * Shared so the Monday cron and a manual regeneration send the identical
 * message. The manual path sent nothing at all before, which meant a batch
 * regenerated by hand — the only way to correct one — went out silently.
 */
export async function notifyPayoutBatchReady(
  notify: (msg: string, subject?: string, html?: string) => Promise<unknown>,
  s: BatchReadySummary,
): Promise<void> {
  const m = (n: number) => (Math.round(n * 100) / 100).toFixed(2)
  const msg =
    `Weekly Payout Batch Ready!\n${s.weekStartStr} to ${s.weekEndStr}\n` +
    `${s.shopCount} shop${s.shopCount === 1 ? '' : 's'}: $${m(s.totalShopPayouts)}\n` +
    `${s.driverCount} driver${s.driverCount === 1 ? '' : 's'}: $${m(s.totalDriverPayouts)}\n` +
    `Total: $${m(s.totalAmount)}\n\nReview at donutdash.app/admin/payouts`

  const html = `
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
      <h2 style="color:#10B981;margin-bottom:2px;">Weekly Payout Batch Ready</h2>
      <p style="color:#666;font-size:13px;margin-top:0;">${s.weekStartStr} to ${s.weekEndStr}</p>
      <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:18px;margin:16px 0;">
        <div style="font-size:30px;font-weight:800;color:#10B981;">$${m(s.totalAmount)}</div>
        <div style="font-size:13px;color:#666;margin-top:4px;">total to review</div>
      </div>
      <table style="width:100%;font-size:14px;border-collapse:collapse;">
        <tr><td style="padding:7px 0;color:#555;">Shops (${s.shopCount})</td><td align="right"><strong>$${m(s.totalShopPayouts)}</strong></td></tr>
        <tr><td style="padding:7px 0;color:#555;">Drivers (${s.driverCount})</td><td align="right"><strong>$${m(s.totalDriverPayouts)}</strong></td></tr>
        <tr><td style="padding:10px 0;border-top:2px solid #eee;"><strong>Total</strong></td><td align="right" style="border-top:2px solid #eee;"><strong>$${m(s.totalAmount)}</strong></td></tr>
      </table>
      <a href="https://donutdash.app/admin/payouts" style="display:inline-block;margin-top:14px;padding:12px 24px;background:#10B981;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">Review &amp; Pay</a>
    </div>`

  await notify(msg, `Weekly Payouts Ready: $${m(s.totalAmount)}`, html)
}
