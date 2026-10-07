import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { timingSafeEqual } from 'node:crypto'

// POST /api/pos/processor-feed
//
// Where iPOSpays FEED delivers card transactions as they happen. This is
// the processor's own account of what was charged, arriving independently
// of whatever the register managed to post — which is the whole point. A
// sale the POS lost still shows up here, and the reconcile cron turns it
// into an alert instead of a surprise at close.
//
// Configured in the iPOSpays portal: endpoint URL + Basic auth credentials.
// Set IPOSPAYS_FEED_USER and IPOSPAYS_FEED_PASSWORD to the same values.
//
// HMAC is deliberately NOT implemented. The portal offers it, but the exact
// recipe — which parameters, in what order, and the header they arrive in —
// isn't in the public docs, and a guessed implementation would reject every
// event while looking like silence. Basic auth over HTTPS is documented
// exactly ("Basic (Base64 String)"), so that is what this accepts. If HMAC
// is wanted, get the signing spec from devsupport@dejavoo.io first.
//
// The payload shape is also undocumented. Rather than assume one, every
// field is read through a list of plausible names and the whole payload is
// stored (digits of 12+ masked) so the real shape can be read off the first
// live events — the same approach dd_pos_devices.last_spin_shape took for
// the SPIn envelope. Unparsed is still recorded: a row with a null amount
// and a raw payload beats no row at all.

export const dynamic = 'force-dynamic'

import { maskPans, pick, text, amountToCents, type Json } from '@/lib/processor-feed'

/** Constant-time compare that tolerates length differences. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

function authorized(req: NextRequest): boolean {
  const user = process.env.IPOSPAYS_FEED_USER
  const password = process.env.IPOSPAYS_FEED_PASSWORD
  if (!user || !password) return false
  const header = req.headers.get('authorization') ?? ''
  if (!header.startsWith('Basic ')) return false
  let decoded: string
  try {
    decoded = Buffer.from(header.slice(6).trim(), 'base64').toString('utf8')
  } catch {
    return false
  }
  // Split on the FIRST colon only — a password may contain one.
  const idx = decoded.indexOf(':')
  if (idx < 0) return false
  return safeEqual(decoded.slice(0, idx), user) && safeEqual(decoded.slice(idx + 1), password)
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    // 401 without detail. A feed that can't authenticate is either
    // misconfigured or not iPOSpays, and neither needs help from us.
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const svc = createServiceClient()

  const tpn = text(pick(payload, ['tpn', 'terminalProfileNumber', 'terminalId', 'deviceTpn']))
  const externalId = text(pick(payload, ['externalId', 'externalReferenceId', 'posReferenceId', 'referenceId']))
  const processorTxnId = text(pick(payload, ['transactionId', 'txnId', 'processorTransactionId', 'tranId']))
  const authCode = text(pick(payload, ['authCode', 'approvalCode', 'authorizationCode', 'hostApprovalCode']))
  const refNumber = text(pick(payload, ['refNumber', 'referenceNumber', 'pnRef', 'transNum', 'rrn']))
  const amountCents = amountToCents(pick(payload, ['amount', 'totalAmount', 'transactionAmount', 'baseAmount']))
  const cardBrand = text(pick(payload, ['cardBrand', 'cardType', 'brand', 'paymentBrand']))
  const last4 = text(pick(payload, ['last4', 'cardLast4', 'maskedCardNumber', 'cardNumber']))?.slice(-4) ?? null
  const entryMode = text(pick(payload, ['entryMode', 'posMode', 'cardEntryMode']))
  const txnType = text(pick(payload, ['transactionType', 'txnType', 'type']))
  const batchNumber = text(pick(payload, ['batchNumber', 'batchNo', 'batch']))
  const occurredRaw = text(pick(payload, ['transactionDate', 'dateTime', 'createdAt', 'timestamp', 'txnDate']))
  const occurredAt = occurredRaw && !Number.isNaN(Date.parse(occurredRaw))
    ? new Date(occurredRaw).toISOString()
    : new Date().toISOString()

  // TPN is the only identifier the POS already knows the processor by, so
  // it is how a transaction finds its shop. An unknown TPN still gets a
  // row — an unattributed charge is exactly the kind of thing worth seeing.
  let shopId: string | null = null
  if (tpn) {
    const { data: cred } = await svc
      .from('dd_shop_terminal_credentials')
      .select('shop_id')
      .eq('tpn', tpn)
      .limit(1)
      .maybeSingle()
    shopId = cred?.shop_id ?? null
  }

  const row = {
    shop_id: shopId,
    tpn,
    batch_number: batchNumber,
    amount_cents: amountCents,
    auth_code: authCode,
    ref_number: refNumber,
    card_brand: cardBrand,
    card_last4: last4,
    entry_mode: entryMode,
    transaction_type: txnType,
    occurred_at: occurredAt,
    processor_transaction_id: processorTxnId,
    external_id: externalId,
    raw_payload: maskPans(payload) as Json,
    source: 'feed',
    status: 'unmatched',
  }

  // Delivery is at-least-once, so a repeat of a transaction we already hold
  // is success, not a conflict. The unique indexes on processor_transaction_id
  // and external_id are what make that true; 23505 is a unique violation.
  const { data: inserted, error } = await svc
    .from('dd_processor_transactions')
    .insert(row)
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ ok: true, duplicate: true })
    }
    if (error.code === '42P01') {
      // Table not migrated. 200 so the processor doesn't retry forever
      // against a server that cannot accept it, loud in the log so it gets
      // fixed. The feed has no replay for events it was told we took.
      console.error('[processor-feed] dd_processor_transactions missing — run supabase/card-sale-reconciliation.sql')
      return NextResponse.json({ ok: true, stored: false })
    }
    console.error('[processor-feed] insert failed:', error.message)
    return NextResponse.json({ error: 'Could not store transaction' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: inserted?.id })
}
