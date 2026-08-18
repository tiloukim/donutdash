import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { BASE_DELIVERY_PAY, PER_MILE_PAY, resolveCommissionRate, isPayoutExcluded } from '@/lib/constants'
import { notifyAdmins } from '@/lib/sms'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Vercel cron calls this every Monday at 6 AM CT
// Configured in vercel.json: { "path": "/api/cron/weekly-payout", "schedule": "0 11 * * 1" }
// (11 UTC = 6 AM CT)

export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  // Fail closed: if the secret is unset, reject rather than run this money-moving
  // endpoint publicly.
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()

  try {
    // Calculate previous week (Mon-Sun)
    const now = new Date()
    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() + mondayOffset - 7)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    const weekStartStr = weekStart.toISOString().split('T')[0]
    const weekEndStr = weekEnd.toISOString().split('T')[0]

    // Check if batch already exists. maybeSingle() (vs single()) returns
    // null on 0 rows instead of throwing a 'No rows' PostgREST error,
    // which the cron silently swallowed and re-skipped forever.
    const { data: existing } = await svc.from('dd_payout_batches')
      .select('id').eq('week_start', weekStartStr).maybeSingle()

    if (existing) {
      return NextResponse.json({ message: `Batch already exists for ${weekStartStr}`, skipped: true })
    }

    // Fetch delivered orders for this week. Window by created_at AND
    // exclude pos_walkin: shop already kept 100% at the register so
    // including walk-ins would re-pay the shop a second time.
    //
    // Known imperfection: shops aggregate by orders.created_at while
    // drivers aggregate by deliveries.delivered_at below. An order
    // created late Sunday and delivered next-week-Monday pays the shop
    // in this batch and the driver in next week's — splitting a single
    // order's P&L across two weeks. Acceptable for V1 (the dollar
    // amounts reconcile across batches over time); revisit if reports
    // need same-batch reconciliation.
    const { data: orders } = await svc.from('dd_orders')
      .select('id, subtotal, total, refund_amount, shop_id, tip, status, commission_pct')
      .eq('status', 'delivered')
      .in('order_type', ['delivery', 'pickup'])
      .gte('created_at', weekStart.toISOString())
      .lte('created_at', weekEnd.toISOString())

    // Fetch completed deliveries
    const { data: deliveries } = await svc.from('dd_deliveries')
      .select('id, order_id, driver_id, driver_earnings, base_pay, distance_miles, delivered_at, order:dd_orders(tip)')
      .eq('status', 'delivered')
      .gte('delivered_at', weekStart.toISOString())
      .lte('delivered_at', weekEnd.toISOString())

    // Fetch users + shops
    const { data: allUsers } = await svc.from('dd_users')
      .select('id, name, email, role, bank_account_holder, bank_routing_number, bank_account_number, payout_method, paypal_email')
      .in('role', ['driver', 'shop_owner'])

    const { data: shops } = await svc.from('dd_shops').select('id, name, owner_id')

    const userMap = new Map((allUsers || []).map(u => [u.id, u]))
    const shopsById = new Map((shops || []).map(s => [s.id, s]))

    // Calculate driver payouts
    const driverEarnings = new Map<string, { amount: number; deliveries: number; basePay: number; tips: number }>()
    for (const del of deliveries || []) {
      if (!del.driver_id) continue
      // Skip the operator's own / demo driver accounts — no self-payouts.
      if (isPayoutExcluded(userMap.get(del.driver_id)?.email)) continue
      // Trust the stored driver_earnings (set at offer time) — that's the
      // figure the driver was promised. Only fall back to a recompute when
      // the row has no stored value, and use one-way distance + current
      // constants when we do.
      const stored = Number(del.driver_earnings) || 0
      const tip = Number((del.order as any)?.tip) || 0
      const basePay = Number(del.base_pay) || BASE_DELIVERY_PAY
      const distanceMiles = Number(del.distance_miles) || 0
      const earnings = stored > 0
        ? stored
        : Math.round((basePay + distanceMiles * PER_MILE_PAY + tip) * 100) / 100

      const existing = driverEarnings.get(del.driver_id) || { amount: 0, deliveries: 0, basePay: 0, tips: 0 }
      existing.amount += earnings
      existing.deliveries += 1
      existing.basePay += basePay
      existing.tips += tip
      driverEarnings.set(del.driver_id, existing)
    }

    // Calculate shop payouts. Refunds applied proportionally (same
    // pattern as /api/admin/payouts + /api/shop/earnings).
    const shopEarnings = new Map<string, { amount: number; orders: number; subtotal: number; commission: number }>()
    for (const order of orders || []) {
      const shopId = order.shop_id
      // Skip the operator's own shops — the platform owner doesn't pay themselves.
      if (isPayoutExcluded(userMap.get(shopsById.get(shopId)?.owner_id)?.email)) continue
      const subtotal = Number(order.subtotal || 0)
      const total = Number(order.total || 0)
      const refund = Number(order.refund_amount || 0)
      const refundRatio = refund > 0 && total > 0 ? Math.min(refund / total, 1) : 0
      const effSub = Math.max(0, subtotal * (1 - refundRatio))
      const commission = effSub * resolveCommissionRate(order)
      const payout = effSub - commission

      const existing = shopEarnings.get(shopId) || { amount: 0, orders: 0, subtotal: 0, commission: 0 }
      existing.amount += payout
      existing.orders += 1
      existing.subtotal += effSub
      existing.commission += commission
      shopEarnings.set(shopId, existing)
    }

    const totalDriverPayouts = Array.from(driverEarnings.values()).reduce((s, d) => s + d.amount, 0)
    const totalShopPayouts = Array.from(shopEarnings.values()).reduce((s, d) => s + d.amount, 0)
    const totalAmount = Math.round((totalDriverPayouts + totalShopPayouts) * 100) / 100

    // Skip if no payouts
    if (totalAmount === 0) {
      return NextResponse.json({ message: `No payouts for week of ${weekStartStr}`, skipped: true })
    }

    // Create batch
    const { data: batch, error: batchError } = await svc.from('dd_payout_batches').insert({
      week_start: weekStartStr,
      week_end: weekEndStr,
      total_driver_payouts: Math.round(totalDriverPayouts * 100) / 100,
      total_shop_payouts: Math.round(totalShopPayouts * 100) / 100,
      total_amount: totalAmount,
      status: 'pending',
    }).select().single()

    if (batchError) throw new Error(batchError.message)

    // Create payout items
    const items: any[] = []

    for (const [driverId, data] of driverEarnings.entries()) {
      if (data.amount <= 0) continue
      const u = userMap.get(driverId)
      items.push({
        batch_id: batch.id,
        user_id: driverId,
        user_type: 'driver',
        amount: Math.round(data.amount * 100) / 100,
        earnings_breakdown: { deliveries: data.deliveries, basePay: data.basePay, tips: data.tips },
        bank_info: u ? {
          holder: u.bank_account_holder,
          routing: u.bank_routing_number,
          account: u.bank_account_number,
          method: u.payout_method || 'ach',
          paypal: u.paypal_email,
        } : null,
        status: 'pending',
      })
    }

    for (const [shopId, data] of shopEarnings.entries()) {
      if (data.amount <= 0) continue
      const shop = shopsById.get(shopId)
      const ownerId = shop?.owner_id
      const u = ownerId ? userMap.get(ownerId) : null
      items.push({
        batch_id: batch.id,
        user_id: ownerId || shopId,
        user_type: 'shop_owner',
        shop_id: shopId,
        amount: Math.round(data.amount * 100) / 100,
        earnings_breakdown: { orders: data.orders, subtotal: data.subtotal, commission: data.commission },
        bank_info: u ? {
          holder: u.bank_account_holder,
          routing: u.bank_routing_number,
          account: u.bank_account_number,
          method: u.payout_method || 'ach',
          paypal: u.paypal_email,
        } : null,
        status: 'pending',
      })
    }

    if (items.length > 0) {
      await svc.from('dd_payout_items').insert(items)
    }

    // Notify admin
    const driverCount = driverEarnings.size
    const shopCount = shopEarnings.size
    const msg = `Weekly Payout Batch Ready!\n${weekStartStr} to ${weekEndStr}\n${shopCount} shops: $${Math.round(totalShopPayouts * 100) / 100}\n${driverCount} drivers: $${Math.round(totalDriverPayouts * 100) / 100}\nTotal: $${totalAmount}\n\nReview at donutdash.app/admin/payouts`

    await notifyAdmins(msg, `Weekly Payouts Ready: $${totalAmount}`, `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
        <h2 style="color:#10B981;">Weekly Payout Batch Ready</h2>
        <p style="color:#666;">${weekStartStr} to ${weekEndStr}</p>
        <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:16px;margin:16px 0;">
          <div style="font-size:28px;font-weight:800;color:#10B981;">$${totalAmount}</div>
          <div style="font-size:14px;color:#666;margin-top:4px;">${shopCount} shops ($${Math.round(totalShopPayouts * 100) / 100}) + ${driverCount} drivers ($${Math.round(totalDriverPayouts * 100) / 100})</div>
        </div>
        <a href="https://donutdash.app/admin/payouts" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#10B981;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">Review & Pay</a>
      </div>
    `)

    return NextResponse.json({
      message: `Batch created for ${weekStartStr} to ${weekEndStr}`,
      batch: batch.id,
      totalAmount,
      shopCount,
      driverCount,
      itemCount: items.length,
    })
  } catch (err: any) {
    console.error('Weekly payout cron error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
