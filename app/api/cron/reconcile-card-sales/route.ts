import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { notifyAdmins } from '@/lib/sms'
import { pushAdmins } from '@/lib/push-server'

// Compares what the processor charged against what the POS recorded.
//
// Two ways money gets taken without the POS knowing:
//   1. The register charges the card, then fails to post the order. It
//      retries timeouts but drops 4xx, so a rejected sale is gone — see
//      order 46ADB, and the $3.36 Discover sale on 7 Oct 2026 that left
//      the POS $3.36 short of terminal batch 029.
//   2. Anything else that loses the response between terminal and server.
//
// The feed at /api/pos/processor-feed records the processor's side as it
// happens. This job pairs those rows off against orders and shouts about
// the ones that don't pair, which is the alarm nobody had.
//
// It also covers case 1 from the POS side: orders the route accepted
// despite a figure it disagreed with are flagged, and get told about here.

const GRACE_MS = 10 * 60 * 1000       // the register's own retry window
const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000
const AMOUNT_WINDOW_MS = 15 * 60 * 1000

type ProcessorTxn = {
  id: string
  shop_id: string | null
  amount_cents: number | null
  auth_code: string | null
  ref_number: string | null
  external_id: string | null
  occurred_at: string | null
}

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()
  const now = Date.now()
  const lookback = new Date(now - LOOKBACK_MS).toISOString()

  const { data: pending, error } = await svc
    .from('dd_processor_transactions')
    .select('id, shop_id, amount_cents, auth_code, ref_number, external_id, occurred_at')
    .eq('status', 'unmatched')
    .gte('occurred_at', lookback)
    .order('occurred_at', { ascending: true })

  // 42P01 = the table isn't migrated yet. This runs every few minutes;
  // without this it would 500 all day and bury real failures. Say so once
  // per run and do nothing else — reconciliation is simply off until
  // supabase/card-sale-reconciliation.sql is applied.
  if (error) {
    const unmigrated = (error as { code?: string }).code === '42P01'
    return NextResponse.json(
      { error: error.message, ...(unmigrated ? { skipped: 'dd_processor_transactions not migrated' } : {}) },
      { status: unmigrated ? 200 : 500 },
    )
  }

  let matched = 0
  const stillMissing: ProcessorTxn[] = []

  for (const txn of (pending ?? []) as ProcessorTxn[]) {
    const match = await findOrder(svc, txn)
    if (match) {
      await svc
        .from('dd_processor_transactions')
        .update({ status: 'matched', matched_order_id: match.id, matched_by: match.by })
        .eq('id', txn.id)
      matched++
      continue
    }
    // Inside the grace window the register may still be retrying. Only
    // what survives that is genuinely missing.
    const age = now - new Date(txn.occurred_at ?? 0).getTime()
    if (age >= GRACE_MS) stillMissing.push(txn)
  }

  // One alert per transaction — alerted_at is what lets this run often.
  const toAlert = stillMissing.filter((t) => t.id)
  const { data: unalerted } = await svc
    .from('dd_processor_transactions')
    .select('id, amount_cents, auth_code, occurred_at, card_brand, card_last4, tpn')
    .in('id', toAlert.length > 0 ? toAlert.map((t) => t.id) : ['00000000-0000-0000-0000-000000000000'])
    .is('alerted_at', null)

  for (const txn of unalerted ?? []) {
    const amount = txn.amount_cents != null ? `$${(txn.amount_cents / 100).toFixed(2)}` : 'unknown amount'
    const card = [txn.card_brand, txn.card_last4].filter(Boolean).join(' ')
    const when = txn.occurred_at ? new Date(txn.occurred_at).toLocaleString('en-US') : 'unknown time'
    const message =
      `Card sale not in the POS: ${amount}${card ? ` (${card})` : ''} at ${when}. ` +
      `Approval ${txn.auth_code ?? '—'}, TPN ${txn.tpn ?? '—'}. ` +
      `The processor took the money and no order matches it.`
    await notifyAdmins(message, 'Card sale missing from the POS')
    await pushAdmins('Card sale missing from the POS', message, '/admin/orders')
    await svc
      .from('dd_processor_transactions')
      .update({ alerted_at: new Date().toISOString() })
      .eq('id', txn.id)
  }

  // The other half: sales the orders route took despite disagreeing with
  // the register's arithmetic. Recorded rather than lost, but somebody
  // should look at why the figures differed.
  let flaggedAlerted = 0
  const { data: flagged } = await svc
    .from('dd_orders')
    .select('id, short_code, total, reconcile_note, created_at')
    .not('reconcile_flag', 'is', null)
    .is('reconcile_alerted_at', null)
    .gte('created_at', lookback)
    .limit(20)

  for (const order of flagged ?? []) {
    const message =
      `Order ${order.short_code ?? order.id} recorded at $${order.total} despite a figure mismatch ` +
      `(${order.reconcile_note ?? 'no detail'}). The card was already charged, so the sale was kept. Worth a look.`
    await notifyAdmins(message, 'POS order recorded with a mismatch')
    await svc
      .from('dd_orders')
      .update({ reconcile_alerted_at: new Date().toISOString() })
      .eq('id', order.id)
    flaggedAlerted++
  }

  return NextResponse.json({
    checked: pending?.length ?? 0,
    matched,
    missing: stillMissing.length,
    alerted: (unalerted ?? []).length,
    flagged_orders_alerted: flaggedAlerted,
  })
}

/** Rules run strongest first. external_id is the register's own handle on
 *  the sale, an auth code is unique per approval, a reference number is
 *  the gateway's. Amount-and-time is a guess and is recorded as one. */
async function findOrder(
  svc: ReturnType<typeof createServiceClient>,
  txn: ProcessorTxn,
): Promise<{ id: string; by: string } | null> {
  const inShop = <T>(q: T): T => {
    // Orders are scoped to a shop whenever the TPN resolved to one. An
    // unattributed transaction may still match on a globally unique auth
    // code, which is better than not matching at all.
    return txn.shop_id ? ((q as { eq: (c: string, v: string) => T }).eq('shop_id', txn.shop_id) as T) : q
  }

  if (txn.external_id) {
    const { data } = await inShop(
      svc.from('dd_orders').select('id').eq('client_order_id', txn.external_id),
    ).limit(1).maybeSingle()
    if (data) return { id: data.id, by: 'external_id' }
  }

  if (txn.auth_code) {
    const { data } = await inShop(
      svc.from('dd_orders').select('id').eq('card_auth_code', txn.auth_code),
    ).limit(1).maybeSingle()
    if (data) return { id: data.id, by: 'auth_code' }
  }

  if (txn.ref_number) {
    const { data } = await inShop(
      svc.from('dd_orders').select('id').eq('card_ref_number', txn.ref_number),
    ).limit(1).maybeSingle()
    if (data) return { id: data.id, by: 'ref_number' }
  }

  // Last resort. Same money, same quarter hour, no auth code recorded on
  // the order — which is the shape of a sale posted before the gateway
  // fields were being saved. Deliberately last: two $3.36 sales minutes
  // apart would both match, and matching the wrong one hides a real gap.
  if (txn.amount_cents != null && txn.occurred_at) {
    const at = new Date(txn.occurred_at).getTime()
    const { data } = await inShop(
      svc
        .from('dd_orders')
        .select('id')
        .eq('total', Number((txn.amount_cents / 100).toFixed(2)))
        .neq('payment_method', 'cash')
        .is('card_auth_code', null)
        .gte('created_at', new Date(at - AMOUNT_WINDOW_MS).toISOString())
        .lte('created_at', new Date(at + AMOUNT_WINDOW_MS).toISOString()),
    ).limit(2)
    if (data && data.length === 1) return { id: data[0].id, by: 'amount_time' }
  }

  return null
}
