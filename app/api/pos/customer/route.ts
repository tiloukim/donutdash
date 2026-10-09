import { NextRequest, NextResponse } from 'next/server'
import { authorizeForShop } from '@/lib/pos-shop-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/phone'

export const dynamic = 'force-dynamic'

/**
 * A customer's full rewards account, for the cashier.
 *
 * Separate from /api/pos/cash on purpose. That route answers "what can this
 * sale do?" and is deliberately thin — it feeds a counter-facing screen, so
 * it masks the phone and carries no history. This one answers "who is this?"
 * for somebody standing behind the till who may need to correct a name, read
 * a balance back, or explain where it came from.
 *
 *   GET   ?phone=9035551212   the account and its recent movements
 *   PATCH { phone, name }     correct what the counter got wrong
 */

export async function GET(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get('shop_id') ?? ''
  const a = await authorizeForShop(shopId)
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })
  const svc = createServiceClient()

  const phone = normalizePhone(req.nextUrl.searchParams.get('phone'))
  if (!phone) return NextResponse.json({ error: 'Enter a 10-digit mobile number.' }, { status: 400 })

  // Live records only, by the same rule the unique index uses, so a merged
  // duplicate can never be surfaced as a second account for one person.
  const { data: customer } = await svc
    .from('dd_users')
    .select('id, name, phone, email, created_at')
    .eq('role', 'customer')
    .eq('phone_normalized', phone)
    .is('merged_into', null)
    .maybeSingle()

  if (!customer) return NextResponse.json({ found: false })

  const { data: wallet } = await svc
    .from('dd_cash_wallets')
    .select('id, balance_cents, lifetime_earned_cents, lifetime_redeemed_cents, recoverable_offset_cents, created_at')
    .eq('customer_id', customer.id)
    .eq('shop_id', shopId)
    .maybeSingle()

  // Recent movements, with the order they came from so a cashier can answer
  // "where did that come from?" rather than just reporting a number.
  // Filtered by WALLET, not by shop.
  //
  // The wallet is already per-shop, so this is the same set — except for the
  // rows the shop filter silently drops. The points conversion wrote
  // ADMIN_ADJUSTMENT rows with shop_id = null, because the old points
  // programme was platform-wide and backdating a shop onto them would have
  // been inventing a fact. Those rows still fund this wallet.
  //
  // Filtering on shop_id meant a customer showing a $0.53 balance had an
  // activity list summing to −$0.85, and a cashier asked to explain the
  // difference had nothing to point at. wallet_id is exact: every row that
  // moved this balance, and no row that did not.
  const { data: ledger } = wallet
    ? await svc
        .from('dd_cash_ledger')
        .select('transaction_type, amount_cents, balance_after_cents, created_at, rate_bps, order_id, description')
        .eq('wallet_id', wallet.id)
        .order('created_at', { ascending: false })
        .limit(20)
    : { data: [] as never[] }

  const orderIds = [...new Set((ledger ?? []).map((l) => l.order_id).filter(Boolean))]
  const { data: orders } = orderIds.length
    ? await svc.from('dd_orders').select('id, short_code, total, created_at').in('id', orderIds)
    : { data: [] as { id: string; short_code: string | null; total: number; created_at: string }[] }
  const orderById = new Map((orders ?? []).map((o) => [o.id, o]))

  // How much they have spent here, which is the question an owner asks about
  // a regular and which no screen currently answers.
  const { count: visits } = await svc
    .from('dd_orders')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customer.id)
    .eq('shop_id', shopId)
    .in('status', ['delivered', 'picked_up'])

  return NextResponse.json({
    found: true,
    customer: {
      id: customer.id,
      name: customer.name,
      // UNMASKED here, unlike the counter-facing route: a cashier correcting
      // a mistyped number has to be able to see the number they are fixing.
      phone: customer.phone,
      // Synthetic addresses are an implementation detail of enrolling by
      // phone, not something to show as if the customer gave it.
      email: (customer.email ?? '').endsWith('@donutdash.invalid') ? null : customer.email,
      joined_at: customer.created_at,
      visits: visits ?? 0,
    },
    wallet: wallet
      ? {
          balance_cents: Number(wallet.balance_cents ?? 0),
          lifetime_earned_cents: Number(wallet.lifetime_earned_cents ?? 0),
          lifetime_redeemed_cents: Number(wallet.lifetime_redeemed_cents ?? 0),
          owed_back_cents: Number(wallet.recoverable_offset_cents ?? 0),
        }
      : null,
    ledger: (ledger ?? []).map((l) => ({
      type: l.transaction_type,
      amount_cents: Number(l.amount_cents),
      balance_after_cents: Number(l.balance_after_cents ?? 0),
      at: l.created_at,
      rate_bps: l.rate_bps,
      description: l.description,
      order: l.order_id ? orderById.get(l.order_id) ?? null : null,
    })),
  })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const a = await authorizeForShop(body?.shop_id ?? '')
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })
  const svc = createServiceClient()

  const phone = normalizePhone(body?.phone)
  if (!phone) return NextResponse.json({ error: 'Enter a 10-digit mobile number.' }, { status: 400 })

  const { data: customer } = await svc
    .from('dd_users')
    .select('id')
    .eq('role', 'customer')
    .eq('phone_normalized', phone)
    .is('merged_into', null)
    .maybeSingle()
  if (!customer) return NextResponse.json({ error: 'No customer with that number.' }, { status: 404 })

  const updates: Record<string, unknown> = {}

  if (typeof body.name === 'string') {
    const name = body.name.trim().slice(0, 60)
    if (!name) return NextResponse.json({ error: 'Enter a name.' }, { status: 400 })
    updates.name = name
  }

  // The phone is NOT editable here, deliberately.
  //
  // It is the identity: wallets, the ledger and every past sale hang off it,
  // and the unique index means changing it can collide with a real second
  // customer. Correcting a mistyped number is a merge, not an edit, and
  // doing it as an edit would silently move one person's balance onto
  // another's record. If that is needed it gets its own flow with its own
  // confirmation.
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 })
  }

  const { data: saved, error } = await svc
    .from('dd_users')
    .update(updates)
    .eq('id', customer.id)
    .select('id, name, phone')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, customer: saved })
}
