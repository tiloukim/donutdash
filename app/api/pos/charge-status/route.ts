import { NextRequest, NextResponse } from 'next/server'
import { authorizeForShop } from '@/lib/pos-shop-auth'

// GET /api/pos/charge-status?shop_id=<uuid>&external_id=pos-1791372318022
//     [&amount_cents=336&card_last4=2110&tpn=75555982&window_minutes=15]
//
// "Did this card already get charged?" — for the register to ask when the
// terminal approved and it never heard back.
//
// That silence is what makes a customer pay twice: the screen still shows
// Charge, the cashier presses it, the card is run again, and the shop ends
// up issuing a refund. It has happened three times. The register must not
// offer Charge again until it has asked this.
//
// The answer comes from dd_processor_transactions — what the processor
// itself reported through FEED, which arrives whether or not the register
// heard anything.
//
// READ THE ANSWER CAREFULLY. 'charged' is proof. 'no_record' is NOT proof
// of the opposite: it means nothing has reached us, which is also what a
// feed outage looks like, and what the first seconds after a real charge
// look like. `confident` says whether the absence means anything — it is
// false when the feed has delivered nothing recently, and the register
// should then fall back to asking the cashier to read the terminal rather
// than silently charging again.

export const dynamic = 'force-dynamic'

// If the feed has gone quiet for longer than this, silence tells us nothing.
const FEED_HEALTHY_WITHIN_MS = 6 * 60 * 60 * 1000
const DEFAULT_WINDOW_MINUTES = 15

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const shopId = url.searchParams.get('shop_id')
  const externalId = url.searchParams.get('external_id')
  const amountCents = url.searchParams.get('amount_cents')
  const cardLast4 = url.searchParams.get('card_last4')
  const tpn = url.searchParams.get('tpn')
  const windowMinutes = Number(url.searchParams.get('window_minutes') ?? DEFAULT_WINDOW_MINUTES)

  if (!shopId) {
    return NextResponse.json({ error: 'shop_id required' }, { status: 400 })
  }
  if (!externalId && !amountCents) {
    return NextResponse.json(
      { error: 'external_id or amount_cents required' },
      { status: 400 },
    )
  }

  const a = await authorizeForShop(shopId)
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  const select =
    'id, amount_cents, auth_code, ref_number, card_brand, card_last4, occurred_at, status, matched_order_id, external_id'

  // The register's own id for the sale. An exact answer when present, and
  // the reason the register should always send one.
  if (externalId) {
    const { data, error } = await a.svc
      .from('dd_processor_transactions')
      .select(select)
      .eq('external_id', externalId)
      .limit(1)
      .maybeSingle()
    if (error && (error as { code?: string }).code === '42P01') return notMigrated()
    if (data) return NextResponse.json({ status: 'charged', confident: true, matched_by: 'external_id', transaction: data })
  }

  // Failing that, the same money on the same card at the same terminal
  // within the last few minutes. Good enough to stop a second charge,
  // which is the only decision being made here.
  let fallback: Record<string, unknown> | null = null
  if (amountCents) {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()
    let q = a.svc
      .from('dd_processor_transactions')
      .select(select)
      .eq('amount_cents', Number(amountCents))
      .gte('occurred_at', since)
      .order('occurred_at', { ascending: false })
      .limit(1)
    if (cardLast4) q = q.eq('card_last4', cardLast4)
    if (tpn) q = q.eq('tpn', tpn)
    const { data, error } = await q.maybeSingle()
    if (error && (error as { code?: string }).code === '42P01') return notMigrated()
    fallback = data ?? null
    if (fallback) {
      return NextResponse.json({
        status: 'charged',
        // Weaker than an id match: a customer buying the same thing twice
        // on the same card looks identical. Said plainly so the register
        // can show the cashier rather than decide alone.
        confident: false,
        matched_by: cardLast4 ? 'amount_card_time' : 'amount_time',
        transaction: fallback,
      })
    }
  }

  // Nothing found. Whether that means anything depends entirely on the
  // feed still being alive.
  const { data: latest, error: healthErr } = await a.svc
    .from('dd_processor_transactions')
    .select('occurred_at')
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (healthErr && (healthErr as { code?: string }).code === '42P01') return notMigrated()

  const lastSeen = latest?.occurred_at ? new Date(latest.occurred_at).getTime() : 0
  const feedHealthy = lastSeen > 0 && Date.now() - lastSeen < FEED_HEALTHY_WITHIN_MS

  return NextResponse.json({
    status: 'no_record',
    // Only an active feed makes silence meaningful.
    confident: feedHealthy,
    feed_last_event_at: latest?.occurred_at ?? null,
    advice: feedHealthy
      ? 'No charge reported for this sale. Safe to retry.'
      : 'No processor data is arriving, so this proves nothing. Read the terminal before charging again.',
  })
}

function notMigrated() {
  // The feed table is what this route answers from. Without it the honest
  // answer is "I cannot tell", never "not charged".
  return NextResponse.json({
    status: 'no_record',
    confident: false,
    advice: 'Reconciliation is not set up, so this proves nothing. Read the terminal before charging again.',
    detail: 'dd_processor_transactions missing — run supabase/card-sale-reconciliation.sql',
  })
}
