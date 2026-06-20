import { NextRequest, NextResponse } from 'next/server'
import { authorizeForShop } from '@/lib/pos-shop-auth'
import { getNeteviaClientForShop } from '@/lib/netevia'

// POST /api/pos/batches/settle
//
// Force-close the current open batch for a shop. Most accounts are on
// Netevia auto-batch (cuts at the merchant's configured local time),
// but this exists for:
//   - End-of-day "close out" from the POS at shifts end
//   - Long-weekend "settle now so funds land Monday" flow
//   - Reconciliation override when an auto-batch failed
//
// Returns the dd_payment_batches row that was created. The webhook
// will fill in interchange_cents and reconciled status overnight.

interface SettleBody {
  shop_id: string
}

export async function POST(req: NextRequest) {
  let body: SettleBody
  try {
    body = (await req.json()) as SettleBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.shop_id) {
    return NextResponse.json({ error: 'shop_id required' }, { status: 400 })
  }

  // Settling moves money — restrict to admin / GM. Even shop owners
  // don't need to do this themselves day-to-day; auto-batch handles it.
  const a = await authorizeForShop(body.shop_id, {
    privilegedRoles: ['admin', 'general_manager'],
  })
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  // Sum unsettled approved txns so we have a "what we expected" number
  // to compare against Netevia's batch report. Mismatch surfaces as a
  // discrepancy alert on the admin dashboard.
  const { data: unsettled, error: sumErr } = await a.svc
    .from('dd_payments')
    .select('id, amount_cents, kind')
    .eq('shop_id', body.shop_id)
    .eq('status', 'approved')
    .is('batch_id', null)
  if (sumErr) {
    return NextResponse.json({ error: sumErr.message }, { status: 500 })
  }
  if (!unsettled || unsettled.length === 0) {
    return NextResponse.json({ error: 'Nothing to settle' }, { status: 409 })
  }

  const gross = unsettled
    .filter((p) => p.kind === 'charge' || p.kind === 'capture')
    .reduce((s, p) => s + p.amount_cents, 0)
  const refunds = unsettled
    .filter((p) => p.kind === 'refund')
    .reduce((s, p) => s + p.amount_cents, 0)

  const netevia = getNeteviaClientForShop(body.shop_id)
  // Idempotency key = shop + UTC date. Two close calls in the same UTC
  // day reuse the same key, so a double-tap doesn't double-batch (Netevia
  // rejects the second one as a duplicate).
  const idempotencyKey = `batch-${body.shop_id}-${new Date().toISOString().slice(0, 10)}`
  const result = await netevia.closeBatch({ idempotencyKey })

  if (!result.ok) {
    return NextResponse.json({ error: result.message, code: result.code }, { status: 502 })
  }

  const { batchNumber, txnCount, grossCents } = result.data
  const { data: batch, error: insertErr } = await a.svc
    .from('dd_payment_batches')
    .insert({
      shop_id: body.shop_id,
      netevia_batch_number: batchNumber,
      batch_date: new Date().toISOString().slice(0, 10),
      status: 'closed',
      closed_at: new Date().toISOString(),
      txn_count: txnCount,
      gross_cents: grossCents,
      refund_cents: refunds,
    })
    .select('id, netevia_batch_number, batch_date, txn_count, gross_cents, refund_cents, status')
    .single()
  if (insertErr || !batch) {
    return NextResponse.json({
      error: insertErr?.message ?? 'Batch insert failed',
      // Netevia did settle — surface the batch number so ops can
      // reconcile manually.
      netevia_batch_number: batchNumber,
    }, { status: 500 })
  }

  // Link the txns into the new batch row in one update. If this
  // partially fails, the webhook (transaction.settled) will fill in
  // any missing batch_id values as Netevia confirms each one.
  await a.svc
    .from('dd_payments')
    .update({ batch_id: batch.id })
    .in('id', unsettled.map((p) => p.id))

  return NextResponse.json({
    batch: {
      ...batch,
      // Echo the local vs gateway count so the admin UI can flag a
      // mismatch immediately rather than waiting for the morning report.
      local_txn_count: unsettled.length,
      local_gross_cents: gross,
    },
  })
}
