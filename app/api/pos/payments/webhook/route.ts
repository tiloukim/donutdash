import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyWebhookSignature } from '@/lib/netevia'

// POST /api/pos/payments/webhook
//
// Netevia → DonutDash event sink. Authenticated by HMAC signature in
// the X-Netevia-Signature header, NOT by user session — this route is
// called by Netevia's servers, not a browser.
//
// Events we care about today:
//   - transaction.settled    → flip dd_payments.status → 'settled', set batch_id
//   - transaction.chargeback → status → 'chargeback', alert ops
//   - transaction.reversed   → undo prior chargeback (rare)
//   - batch.closed           → mirror dd_payment_batches row from Netevia's side
//
// Webhook delivery is at-least-once. Idempotency is enforced via the
// netevia_transaction_id unique index on dd_payments + the unique
// (shop_id, netevia_batch_number) constraint on dd_payment_batches.

interface NeteviaWebhookEvent {
  eventType: string
  eventId: string
  occurredAt: string
  data: {
    transactionId?: string
    batchNumber?: string
    shopRef?: string
    amount?: number
    interchangeFee?: number
    txnCount?: number
    reason?: string
    [key: string]: unknown
  }
}

export async function POST(req: NextRequest) {
  // Must read raw body for signature verification — JSON.stringify of
  // the parsed object would re-key and break the HMAC.
  const rawBody = await req.text()
  const signature = req.headers.get('x-netevia-signature')
  const secret = process.env.NETEVIA_WEBHOOK_SECRET
  if (!secret) {
    // Misconfiguration — log and 500. Don't 200 silently, or Netevia
    // will think delivery succeeded and we'll lose the event.
    console.error('NETEVIA_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }
  if (!verifyWebhookSignature({ rawBody, signatureHeader: signature, secret })) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: NeteviaWebhookEvent
  try {
    event = JSON.parse(rawBody) as NeteviaWebhookEvent
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const svc = createServiceClient()

  switch (event.eventType) {
    case 'transaction.settled': {
      if (!event.data.transactionId || !event.data.batchNumber) {
        return NextResponse.json({ error: 'Missing transactionId or batchNumber' }, { status: 400 })
      }
      // Find the batch row, or insert it if this is the first settled
      // txn for this batch (depends on event ordering — Netevia doesn't
      // guarantee batch.closed arrives before its first txn.settled).
      const { data: payment } = await svc
        .from('dd_payments')
        .select('id, shop_id')
        .eq('netevia_transaction_id', event.data.transactionId)
        .maybeSingle()
      if (!payment) {
        // Unknown txn — could be a vault-only operation or a race with
        // our charge route. Ack so Netevia stops retrying; nightly
        // reconciliation will surface this if it's a real orphan.
        return NextResponse.json({ ok: true, note: 'unknown_transaction' })
      }

      const { data: batch } = await svc
        .from('dd_payment_batches')
        .upsert({
          shop_id: payment.shop_id,
          netevia_batch_number: event.data.batchNumber,
          batch_date: event.occurredAt.slice(0, 10),
          status: 'closed',
        }, { onConflict: 'shop_id,netevia_batch_number' })
        .select('id')
        .single()

      await svc
        .from('dd_payments')
        .update({
          status: 'settled',
          batch_id: batch?.id ?? null,
          settled_at: event.occurredAt,
          gateway_payload: event as any,
        })
        .eq('id', payment.id)
      return NextResponse.json({ ok: true })
    }

    case 'transaction.chargeback': {
      if (!event.data.transactionId) {
        return NextResponse.json({ error: 'Missing transactionId' }, { status: 400 })
      }
      await svc
        .from('dd_payments')
        .update({
          status: 'chargeback',
          response_message: event.data.reason ?? null,
          gateway_payload: event as any,
        })
        .eq('netevia_transaction_id', event.data.transactionId)
      // TODO: notify ops (Slack / email) — chargebacks have a 60-day
      // response window and require evidence upload via the Netevia portal.
      return NextResponse.json({ ok: true })
    }

    case 'transaction.reversed': {
      // A previously chargebacked txn was won by the merchant.
      if (!event.data.transactionId) {
        return NextResponse.json({ error: 'Missing transactionId' }, { status: 400 })
      }
      await svc
        .from('dd_payments')
        .update({
          status: 'chargeback_reversed',
          gateway_payload: event as any,
        })
        .eq('netevia_transaction_id', event.data.transactionId)
      return NextResponse.json({ ok: true })
    }

    case 'batch.closed': {
      // Reconciler signal — Netevia confirms its books match ours.
      // Update interchange + net once those numbers post (T+1 morning).
      if (!event.data.batchNumber || !event.data.shopRef) {
        return NextResponse.json({ error: 'Missing batchNumber or shopRef' }, { status: 400 })
      }
      await svc
        .from('dd_payment_batches')
        .update({
          interchange_cents: event.data.interchangeFee ?? null,
          net_cents:
            event.data.amount != null && event.data.interchangeFee != null
              ? event.data.amount - event.data.interchangeFee
              : null,
          status: 'reconciled',
          reconciled_at: event.occurredAt,
          txn_count: event.data.txnCount ?? 0,
        })
        .eq('shop_id', event.data.shopRef)
        .eq('netevia_batch_number', event.data.batchNumber)
      return NextResponse.json({ ok: true })
    }

    default:
      // Acknowledge unknown event types so Netevia doesn't endlessly
      // retry them. New event types we don't handle yet are fine to drop.
      return NextResponse.json({ ok: true, note: 'unhandled_event_type', type: event.eventType })
  }
}
