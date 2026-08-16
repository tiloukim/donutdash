import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || ddUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: batch } = await svc.from('dd_payout_batches').select('*').eq('id', id).single()
  if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })

  const { data: items } = await svc.from('dd_payout_items')
    .select('*, user:dd_users!user_id(name, email, phone, payout_method, bank_account_holder, bank_routing_number, bank_account_number, paypal_email, venmo_handle, cashapp_handle), shop:dd_shops!shop_id(name)')
    .eq('batch_id', id)
    .order('user_type', { ascending: true })
    .order('amount', { ascending: false })

  // The bank_info snapshot froze at batch-generation time. If a recipient added
  // (or fixed) their payout details afterward, the snapshot is stale/empty — so
  // fall back to their CURRENT payout info (flagged _live) so you can still pay
  // them without regenerating the batch.
  type Info = { method?: string | null; holder?: string | null; routing?: string | null; account?: string | null; paypal?: string | null; venmo?: string | null; cashapp?: string | null } | null
  const usable = (b: Info) => {
    if (!b) return false
    if (b.method === 'paypal') return !!b.paypal
    if (b.method === 'venmo') return !!b.venmo
    if (b.method === 'cashapp') return !!b.cashapp
    return !!(b.holder && b.routing && b.account)
  }
  type UserRow = { name?: string; email?: string; phone?: string; payout_method?: string | null; bank_account_holder?: string | null; bank_routing_number?: string | null; bank_account_number?: string | null; paypal_email?: string | null; venmo_handle?: string | null; cashapp_handle?: string | null } | null
  const fromUser = (u: UserRow): Info => u ? {
    method: u.payout_method || 'ach',
    holder: u.bank_account_holder, routing: u.bank_routing_number, account: u.bank_account_number,
    paypal: u.paypal_email, venmo: u.venmo_handle, cashapp: u.cashapp_handle,
  } : null

  const enriched = (items || []).map(it => {
    const u = (Array.isArray(it.user) ? it.user[0] : it.user) as UserRow
    const snap = it.bank_info as Info
    let bank_info = snap
    if (!usable(snap)) {
      const live = fromUser(u)
      if (usable(live)) bank_info = { ...live, _live: true } as Info
    }
    // Only expose name/email/phone on the joined user — not the raw payout fields.
    const user = u ? { name: u.name, email: u.email, phone: u.phone } : null
    return { ...it, bank_info, user }
  })

  return NextResponse.json({ batch, items: enriched })
}
