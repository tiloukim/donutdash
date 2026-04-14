import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function getShopId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) return null

  const { data: shop } = await svc.from('dd_shops').select('id').eq('owner_id', ddUser.id).single()
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

  // Also get DonutDash order income for this shop
  const orderQuery = svc.from('dd_orders')
    .select('id, total, status, created_at')
    .eq('shop_id', shopId)
    .neq('status', 'cancelled')
    .gte('created_at', `${year}-01-01`)
    .lte('created_at', `${year}-12-31T23:59:59`)

  const { data: orders } = await orderQuery

  // Aggregate orders by month
  const ordersByMonth: Record<number, { count: number; total: number }> = {}
  for (const o of orders || []) {
    const m = new Date(o.created_at).getMonth()
    if (!ordersByMonth[m]) ordersByMonth[m] = { count: 0, total: 0 }
    ordersByMonth[m].count++
    ordersByMonth[m].total += o.total
  }

  return NextResponse.json({ entries: data || [], ordersByMonth })
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
