import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveCommissionRate } from '@/lib/constants'
import { resolveOwnerShop as getActiveShop } from '@/lib/shop-auth'

async function getShopId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) return null

  const shop = await getActiveShop(svc, ddUser.id)
  return shop?.id || null
}

// GET: Fetch bookkeeping entries with optional filters
export async function GET(req: NextRequest) {
  const shopId = await getShopId()
  if (!shopId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year') || new Date().getFullYear().toString()
  const month = searchParams.get('month') // optional, 0-indexed
  const type = searchParams.get('type') // 'income' or 'expense'

  const svc = createServiceClient()
  let query = svc.from('dd_bookkeeping')
    .select('*')
    .eq('shop_id', shopId)
    .gte('date', `${year}-01-01`)
    .lte('date', `${year}-12-31`)
    .order('date', { ascending: false })

  if (month !== null && month !== undefined && month !== '') {
    const m = parseInt(month) + 1
    const mStr = m.toString().padStart(2, '0')
    const daysInMonth = new Date(parseInt(year), m, 0).getDate()
    query = query.gte('date', `${year}-${mStr}-01`).lte('date', `${year}-${mStr}-${daysInMonth}`)
  }

  if (type) query = query.eq('type', type)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // All-sales view: walk-ins + delivery/pickup. For each order type the
  // shop's effective income differs:
  //   - pos_walkin: shop kept 100% at the register, so shop income = total
  //                 (subtotal + tax). Net of any refund_amount.
  //   - delivery / pickup: shop only gets subtotal × (1 - commission_pct).
  //                        Net of refund_amount applied proportionally.
  const orderQuery = svc.from('dd_orders')
    .select('id, order_type, subtotal, total, tax, commission_pct, refund_amount, status, created_at')
    .eq('shop_id', shopId)
    .neq('status', 'cancelled')
    .gte('created_at', `${year}-01-01`)
    .lte('created_at', `${year}-12-31T23:59:59`)

  const { data: orders } = await orderQuery

  const effSubtotal = (o: { subtotal: number | null; total: number | null; refund_amount?: number | null }) => {
    const s = Number(o.subtotal || 0); const t = Number(o.total || 0); const r = Number(o.refund_amount || 0)
    if (r <= 0 || t <= 0) return s
    return Math.max(0, s * (1 - Math.min(r / t, 1)))
  }
  const shopIncomeFor = (o: { order_type: string | null; subtotal: number | null; total: number | null; tax: number | null; commission_pct: number | null; refund_amount?: number | null }) => {
    const refund = Number(o.refund_amount || 0)
    const total = Number(o.total || 0)
    if (o.order_type === 'pos_walkin') {
      // Shop already pocketed everything; subtract any later refund
      return Math.max(0, total - refund)
    }
    // Delivery / pickup: subtotal × (1 - commission), refund-proportional
    return effSubtotal(o) * (1 - resolveCommissionRate(o))
  }

  // Aggregate by month + by channel (walk-in vs online) so the shop can
  // see where the year's income actually came from.
  const ordersByMonth: Record<number, { count: number; total: number }> = {}
  const byChannel = {
    walkin:   { count: 0, total: 0 },
    delivery: { count: 0, total: 0 },
    pickup:   { count: 0, total: 0 },
  }
  for (const o of orders || []) {
    const m = new Date(o.created_at).getMonth()
    const income = Math.round(shopIncomeFor(o) * 100) / 100
    if (!ordersByMonth[m]) ordersByMonth[m] = { count: 0, total: 0 }
    ordersByMonth[m].count++
    ordersByMonth[m].total += income
    const channel = o.order_type === 'pos_walkin' ? 'walkin'
      : o.order_type === 'pickup' ? 'pickup'
      : 'delivery'
    byChannel[channel].count++
    byChannel[channel].total += income
  }

  return NextResponse.json({ entries: data || [], ordersByMonth, byChannel })
}

// POST: Add a new entry
export async function POST(req: NextRequest) {
  const shopId = await getShopId()
  if (!shopId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { type, date, description, amount, category, source, notes } = body

  if (!type || !date || !description || !amount || !category) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const svc = createServiceClient()
  const { data, error } = await svc.from('dd_bookkeeping').insert({
    shop_id: shopId, type, date, description,
    amount: parseFloat(amount), category,
    source: source || 'manual', notes,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH: Update an entry
export async function PATCH(req: NextRequest) {
  const shopId = await getShopId()
  if (!shopId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  if (updates.amount) updates.amount = parseFloat(updates.amount)
  updates.updated_at = new Date().toISOString()

  const svc = createServiceClient()
  const { data, error } = await svc.from('dd_bookkeeping')
    .update(updates)
    .eq('id', id)
    .eq('shop_id', shopId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE: Remove an entry
export async function DELETE(req: NextRequest) {
  const shopId = await getShopId()
  if (!shopId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const svc = createServiceClient()
  const { error } = await svc.from('dd_bookkeeping')
    .delete()
    .eq('id', id)
    .eq('shop_id', shopId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
