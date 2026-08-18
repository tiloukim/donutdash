import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { BASE_DELIVERY_PAY, PER_MILE_PAY, resolveCommissionRate, isPayoutExcluded } from '@/lib/constants'

export const dynamic = 'force-dynamic'

type SupabaseSvc = ReturnType<typeof createServiceClient>

// Derive a batch's true status from its items. A batch's stored status only
// gets flipped to 'completed' by "Pay All" — paying items one at a time left
// it stuck on 'pending' even when most (or all) items were paid. Deriving from
// the items keeps the batch honest:
//   - no items still pending      → 'completed'
//   - some resolved, some pending → 'partially_paid'
//   - nothing resolved yet        → 'pending'
function deriveStatus(counts: { itemCount: number; pendingCount: number }, fallback: string): string {
  if (counts.itemCount === 0) return fallback || 'pending'
  if (counts.pendingCount === 0) return 'completed'
  if (counts.itemCount - counts.pendingCount > 0) return 'partially_paid'
  return 'pending'
}

// Recompute and persist a single batch's status after its items change.
async function reconcileBatchStatus(svc: SupabaseSvc, batchId: string, processedBy?: string) {
  const [{ data: items }, { data: batch }] = await Promise.all([
    svc.from('dd_payout_items').select('status').eq('batch_id', batchId),
    svc.from('dd_payout_batches').select('processed_at').eq('id', batchId).maybeSingle(),
  ])
  const list = items || []
  const pendingCount = list.filter(i => i.status === 'pending').length
  const status = deriveStatus({ itemCount: list.length, pendingCount }, 'pending')
  const patch: Record<string, unknown> = { status }
  // Stamp processed_at the first time it completes; never overwrite an existing stamp.
  if (status === 'completed' && !(batch as { processed_at?: string } | null)?.processed_at) {
    patch.processed_at = new Date().toISOString()
    if (processedBy) patch.processed_by = processedBy
  }
  await svc.from('dd_payout_batches').update(patch).eq('id', batchId)
  return status
}

// GET — list all payout batches
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || ddUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: batches } = await svc.from('dd_payout_batches')
    .select('*')
    .order('week_start', { ascending: false })
    .limit(20)

  const list = batches || []
  const ids = list.map(b => b.id)
  const { data: allItems } = ids.length
    ? await svc.from('dd_payout_items').select('batch_id, status, amount').in('batch_id', ids)
    : { data: [] as Array<{ batch_id: string; status: string; amount: number }> }

  const round = (n: number) => Math.round(n * 100) / 100
  const agg = new Map<string, { itemCount: number; paidCount: number; pendingCount: number; skippedCount: number; paidAmount: number; pendingAmount: number }>()
  for (const it of allItems || []) {
    const g = agg.get(it.batch_id) || { itemCount: 0, paidCount: 0, pendingCount: 0, skippedCount: 0, paidAmount: 0, pendingAmount: 0 }
    const amt = Number(it.amount || 0)
    g.itemCount++
    if (it.status === 'paid') { g.paidCount++; g.paidAmount += amt }
    else if (it.status === 'pending') { g.pendingCount++; g.pendingAmount += amt }
    else if (it.status === 'skipped') { g.skippedCount++ }
    agg.set(it.batch_id, g)
  }

  const enriched = list.map(b => {
    const g = agg.get(b.id) || { itemCount: 0, paidCount: 0, pendingCount: 0, skippedCount: 0, paidAmount: 0, pendingAmount: 0 }
    const status = deriveStatus({ itemCount: g.itemCount, pendingCount: g.pendingCount }, b.status)
    return { ...b, status, paid_count: g.paidCount, pending_count: g.pendingCount, skipped_count: g.skippedCount, item_count: g.itemCount, paid_amount: round(g.paidAmount), pending_amount: round(g.pendingAmount) }
  })

  // Self-heal: persist the derived status for any batch whose stored value drifted
  // (e.g. the pre-existing batches stuck on 'pending' after item-by-item payments),
  // so every other view — reports, crons — agrees without a manual migration.
  await Promise.all(enriched
    .filter((b, i) => b.status !== list[i].status)
    .map(b => svc.from('dd_payout_batches').update({ status: b.status }).eq('id', b.id)))

  return NextResponse.json({ batches: enriched })
}

// POST — generate a new weekly payout batch
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || ddUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // req.json() can only be consumed once per request — pull every
  // field we might need up front so `skip_item` doesn't silently drop
  // notes by attempting a second parse later in the handler.
  const requestBody = await req.json()
  const { action, batchId, itemId } = requestBody
  const bodyNotes: string | null = typeof requestBody?.notes === 'string' ? requestBody.notes : null

  // Generate new batch for a specific week
  if (action === 'generate') {
    // Week to pay out. If the caller picked one (YYYY-MM-DD), snap it to that
    // week's Monday; otherwise default to the previous completed week (Mon-Sun).
    const weekParam: string | null = typeof requestBody?.weekStart === 'string' ? requestBody.weekStart : null
    let weekStart: Date
    if (weekParam) {
      const picked = new Date(weekParam + 'T00:00:00')
      if (isNaN(picked.getTime())) return NextResponse.json({ error: 'Invalid week' }, { status: 400 })
      const pd = picked.getDay()
      weekStart = new Date(picked)
      weekStart.setDate(picked.getDate() + (pd === 0 ? -6 : 1 - pd)) // snap to Monday
    } else {
      const now = new Date()
      const dayOfWeek = now.getDay()
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      weekStart = new Date(now)
      weekStart.setDate(now.getDate() + mondayOffset - 7) // Previous week's Monday
    }
    weekStart.setHours(0, 0, 0, 0)
    if (weekStart.getTime() > Date.now()) {
      return NextResponse.json({ error: 'Cannot generate a batch for a future week.' }, { status: 400 })
    }
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    const weekStartStr = weekStart.toISOString().split('T')[0]
    const weekEndStr = weekEnd.toISOString().split('T')[0]

    // Check if batch already exists. maybeSingle() returns null on 0 rows
    // instead of throwing (which .single() does in newer supabase-js
    // versions and would falsely block legitimate generations).
    const { data: existing } = await svc.from('dd_payout_batches')
      .select('id')
      .eq('week_start', weekStartStr)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: `Batch already exists for week of ${weekStartStr}` }, { status: 400 })
    }

    // Fetch delivered orders for this week
    const { data: orders } = await svc.from('dd_orders')
      .select('id, subtotal, total, refund_amount, shop_id, tip, status, commission_pct')
      .eq('status', 'delivered')
      .gte('created_at', weekStart.toISOString())
      .lte('created_at', weekEnd.toISOString())

    // Fetch completed deliveries for this week
    const { data: deliveries } = await svc.from('dd_deliveries')
      .select('id, order_id, driver_id, driver_earnings, base_pay, distance_miles, delivered_at, order:dd_orders(tip)')
      .eq('status', 'delivered')
      .gte('delivered_at', weekStart.toISOString())
      .lte('delivered_at', weekEnd.toISOString())

    // Fetch all drivers and shop owners with their payout details (all methods,
    // not just bank — a PayPal/Venmo recipient must not show as "no info").
    const { data: allUsers } = await svc.from('dd_users')
      .select('id, name, email, role, payout_method, bank_account_holder, bank_routing_number, bank_account_number, paypal_email, venmo_handle, cashapp_handle')
      .in('role', ['driver', 'shop_owner'])

    // Fetch shops
    const { data: shops } = await svc.from('dd_shops')
      .select('id, name, owner_id')

    const userMap = new Map((allUsers || []).map(u => [u.id, u]))
    const shopsByOwner = new Map((shops || []).map(s => [s.owner_id, s]))
    const shopsById = new Map((shops || []).map(s => [s.id, s]))

    // Calculate driver payouts
    const driverEarnings = new Map<string, { amount: number; deliveries: number; basePay: number; tips: number }>()
    for (const del of deliveries || []) {
      if (!del.driver_id) continue
      // Skip the operator's own / demo driver accounts — no self-payouts.
      if (isPayoutExcluded(userMap.get(del.driver_id)?.email)) continue
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

    // Calculate shop payouts. Partial refunds (disputes) reduce the effective
    // subtotal proportionally so the shop's clawback matches the refund ratio.
    const shopEarnings = new Map<string, { amount: number; orders: number; subtotal: number; commission: number; refunded: number }>()
    for (const order of orders || []) {
      const shopId = order.shop_id
      // Skip the operator's own shops — the platform owner doesn't pay themselves.
      if (isPayoutExcluded(userMap.get(shopsById.get(shopId)?.owner_id)?.email)) continue
      const subtotal = Number(order.subtotal || 0)
      const total = Number(order.total || 0)
      const refund = Number(order.refund_amount || 0)
      const refundRatio = refund > 0 && total > 0 ? Math.min(refund / total, 1) : 0
      const effectiveSubtotal = Math.max(0, subtotal * (1 - refundRatio))
      const commission = effectiveSubtotal * resolveCommissionRate(order)
      const payout = effectiveSubtotal - commission

      const existing = shopEarnings.get(shopId) || { amount: 0, orders: 0, subtotal: 0, commission: 0, refunded: 0 }
      existing.amount += payout
      existing.orders += 1
      existing.subtotal += effectiveSubtotal
      existing.commission += commission
      existing.refunded += subtotal - effectiveSubtotal
      shopEarnings.set(shopId, existing)
    }

    // Create batch
    const totalDriverPayouts = Array.from(driverEarnings.values()).reduce((s, d) => s + d.amount, 0)
    const totalShopPayouts = Array.from(shopEarnings.values()).reduce((s, s2) => s + s2.amount, 0)

    const { data: batch, error: batchError } = await svc.from('dd_payout_batches').insert({
      week_start: weekStartStr,
      week_end: weekEndStr,
      total_driver_payouts: Math.round(totalDriverPayouts * 100) / 100,
      total_shop_payouts: Math.round(totalShopPayouts * 100) / 100,
      total_amount: Math.round((totalDriverPayouts + totalShopPayouts) * 100) / 100,
      status: 'pending',
    }).select().single()

    if (batchError) return NextResponse.json({ error: batchError.message }, { status: 500 })

    // Create payout items for drivers
    const items: any[] = []
    for (const [driverId, data] of driverEarnings.entries()) {
      if (data.amount <= 0) continue
      const driverUser = userMap.get(driverId)
      items.push({
        batch_id: batch.id,
        user_id: driverId,
        user_type: 'driver',
        amount: Math.round(data.amount * 100) / 100,
        earnings_breakdown: { deliveries: data.deliveries, basePay: data.basePay, tips: data.tips },
        bank_info: driverUser ? {
          method: driverUser.payout_method || 'ach',
          holder: driverUser.bank_account_holder,
          routing: driverUser.bank_routing_number,
          account: driverUser.bank_account_number,
          paypal: driverUser.paypal_email,
          venmo: driverUser.venmo_handle,
          cashapp: driverUser.cashapp_handle,
        } : null,
        status: 'pending',
      })
    }

    // Create payout items for shops
    for (const [shopId, data] of shopEarnings.entries()) {
      if (data.amount <= 0) continue
      const shop = shopsById.get(shopId)
      const ownerId = shop?.owner_id
      const ownerUser = ownerId ? userMap.get(ownerId) : null
      items.push({
        batch_id: batch.id,
        user_id: ownerId || shopId,
        user_type: 'shop_owner',
        shop_id: shopId,
        amount: Math.round(data.amount * 100) / 100,
        earnings_breakdown: { orders: data.orders, subtotal: data.subtotal, commission: data.commission, refunded: data.refunded },
        bank_info: ownerUser ? {
          method: ownerUser.payout_method || 'ach',
          holder: ownerUser.bank_account_holder,
          routing: ownerUser.bank_routing_number,
          account: ownerUser.bank_account_number,
          paypal: ownerUser.paypal_email,
          venmo: ownerUser.venmo_handle,
          cashapp: ownerUser.cashapp_handle,
        } : null,
        status: 'pending',
      })
    }

    if (items.length > 0) {
      await svc.from('dd_payout_items').insert(items)
    }

    return NextResponse.json({ batch, itemCount: items.length })
  }

  // Mark individual item as paid
  if (action === 'pay_item' && itemId) {
    const { data: updated, error } = await svc.from('dd_payout_items')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', itemId)
      .select('batch_id')
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // Roll the batch status forward — paying the last pending item completes it.
    let batchStatus: string | undefined
    if (updated?.batch_id) batchStatus = await reconcileBatchStatus(svc, updated.batch_id, ddUser.id)
    return NextResponse.json({ success: true, batchStatus })
  }

  // Mark all items in batch as paid. Idempotency guard on the batch
  // update so two simultaneous "Pay All" clicks don't overwrite the
  // first processed_at/processed_by stamps with the second click's.
  if (action === 'pay_all' && batchId) {
    const { error: itemsError } = await svc.from('dd_payout_items')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('batch_id', batchId)
      .eq('status', 'pending')

    if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })

    const { data: batchRows, error: batchError } = await svc.from('dd_payout_batches')
      .update({ status: 'completed', processed_at: new Date().toISOString(), processed_by: ddUser.id })
      .eq('id', batchId)
      .in('status', ['pending', 'partially_paid'])
      .select('id')

    if (batchError) return NextResponse.json({ error: batchError.message }, { status: 500 })
    if (!batchRows || batchRows.length === 0) {
      return NextResponse.json({ success: true, alreadyCompleted: true })
    }
    return NextResponse.json({ success: true })
  }

  // Skip an item. Note that req.json() can only be consumed once per
  // request — `action` was already pulled off body above, so we cached
  // the parsed body here to avoid the previous "second read throws and
  // notes silently drop" bug.
  if (action === 'skip_item' && itemId) {
    // bodyNotes was packed into the original parse above; use it directly
    const { data: updated, error } = await svc.from('dd_payout_items')
      .update({ status: 'skipped', notes: bodyNotes || null })
      .eq('id', itemId)
      .select('batch_id')
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // Skipping the last pending item resolves the batch, so re-derive its status.
    let batchStatus: string | undefined
    if (updated?.batch_id) batchStatus = await reconcileBatchStatus(svc, updated.batch_id, ddUser.id)
    return NextResponse.json({ success: true, batchStatus })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
