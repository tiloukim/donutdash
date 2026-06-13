import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { BASE_DELIVERY_PAY, PER_MILE_PAY, resolveCommissionRate } from '@/lib/constants'

export const dynamic = 'force-dynamic'

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

  return NextResponse.json({ batches: batches || [] })
}

// POST — generate a new weekly payout batch
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || ddUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { action, batchId, itemId } = await req.json()

  // Generate new batch for a specific week
  if (action === 'generate') {
    // Calculate current week (Mon-Sun)
    const now = new Date()
    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() + mondayOffset - 7) // Previous week's Monday
    weekStart.setHours(0, 0, 0, 0)
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

    // Fetch all drivers and shop owners with bank info
    const { data: allUsers } = await svc.from('dd_users')
      .select('id, name, email, role, bank_account_holder, bank_routing_number, bank_account_number')
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
          holder: driverUser.bank_account_holder,
          routing: driverUser.bank_routing_number,
          account: driverUser.bank_account_number,
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
          holder: ownerUser.bank_account_holder,
          routing: ownerUser.bank_routing_number,
          account: ownerUser.bank_account_number,
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
    const { error } = await svc.from('dd_payout_items')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', itemId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // Mark all items in batch as paid
  if (action === 'pay_all' && batchId) {
    const { error: itemsError } = await svc.from('dd_payout_items')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('batch_id', batchId)
      .eq('status', 'pending')

    if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })

    const { error: batchError } = await svc.from('dd_payout_batches')
      .update({ status: 'completed', processed_at: new Date().toISOString(), processed_by: ddUser.id })
      .eq('id', batchId)

    if (batchError) return NextResponse.json({ error: batchError.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // Skip an item
  if (action === 'skip_item' && itemId) {
    const body = await req.json().catch(() => ({}))
    const { error } = await svc.from('dd_payout_items')
      .update({ status: 'skipped', notes: (body as any).notes || null })
      .eq('id', itemId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
