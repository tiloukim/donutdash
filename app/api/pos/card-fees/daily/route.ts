import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { POS_CARD_TRANSACTION_FEE } from '@/lib/constants'

// GET /api/pos/card-fees/daily?date=YYYY-MM-DD[&shop_id=uuid]
//
// Billing pull for the POS card-transaction fee. Returns, for a single day
// (UTC), each shop's card-fee total owed — the amount the processor/billing
// backend charges the shop owner at end of day. Reads the dd_pos_card_fees
// ledger (service role). Money is NOT moved here — this only reports totals.
//
// Auth (either):
//   • machine: header `x-billing-key: <POS_BILLING_KEY>` (env) — for the
//     processor backend's automated pull, and
//   • human: an admin / general_manager / field_manager session.
//
// `date` defaults to today (UTC). Omit shop_id for the whole fleet.

export const dynamic = 'force-dynamic'

async function authorize(req: NextRequest): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const key = process.env.POS_BILLING_KEY
  const provided = req.headers.get('x-billing-key')
  if (key && provided && provided === key) return { ok: true }

  const auth = await createClient()
  const { data: { user }, error } = await auth.auth.getUser()
  if (error || !user) return { ok: false, status: 401, error: 'Unauthorized' }
  const svc = createServiceClient()
  const { data: caller } = await svc.from('dd_users').select('role').eq('auth_id', user.id).single()
  if (!caller || !['admin', 'general_manager', 'field_manager'].includes(caller.role)) {
    return { ok: false, status: 403, error: 'Admin only' }
  }
  return { ok: true }
}

// YYYY-MM-DD → [startUtc, endUtc) covering that whole UTC day.
function dayBounds(date: string): { from: string; to: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const start = new Date(`${date}T00:00:00.000Z`)
  if (Number.isNaN(start.getTime())) return null
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { from: start.toISOString(), to: end.toISOString() }
}

export async function GET(req: NextRequest) {
  const a = await authorize(req)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })

  const dateParam = req.nextUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10)
  const bounds = dayBounds(dateParam)
  if (!bounds) return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
  const shopId = req.nextUrl.searchParams.get('shop_id')

  const svc = createServiceClient()
  let q = svc
    .from('dd_pos_card_fees')
    .select('shop_id, amount')
    .gte('created_at', bounds.from)
    .lt('created_at', bounds.to)
  if (shopId) q = q.eq('shop_id', shopId)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Aggregate per shop.
  const byShop = new Map<string, { count: number; total: number }>()
  for (const r of (data ?? []) as Array<{ shop_id: string; amount: number | null }>) {
    const agg = byShop.get(r.shop_id) ?? { count: 0, total: 0 }
    agg.count += 1
    agg.total += Number(r.amount ?? 0)
    byShop.set(r.shop_id, agg)
  }

  // Attach shop names.
  const ids = [...byShop.keys()]
  const names = new Map<string, string>()
  if (ids.length) {
    const { data: shops } = await svc.from('dd_shops').select('id, name').in('id', ids)
    for (const s of shops ?? []) names.set(s.id, s.name)
  }

  const shops = [...byShop.entries()]
    .map(([id, agg]) => ({
      shop_id: id,
      shop_name: names.get(id) ?? null,
      card_txn_count: agg.count,
      total_owed: Math.round(agg.total * 100) / 100,
    }))
    .sort((x, y) => y.total_owed - x.total_owed)

  const grandTotal = Math.round(shops.reduce((s, x) => s + x.total_owed, 0) * 100) / 100

  return NextResponse.json({
    date: dateParam,
    fee_per_txn: POS_CARD_TRANSACTION_FEE,
    grand_total: grandTotal,
    shops,
  })
}
