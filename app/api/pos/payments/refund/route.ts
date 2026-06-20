import { NextRequest, NextResponse } from 'next/server'
import { authorizeForShop } from '@/lib/pos-shop-auth'
import { getNeteviaClientForShop } from '@/lib/netevia'

// POST /api/pos/payments/refund
//
// Issues a refund through Netevia and writes both a dd_payments
// (kind='refund') row and a dd_payment_refunds context row.
//
// Refund vs void: use refund post-settlement, void pre-settlement.
// This route accepts either case but the caller should prefer void
// if they know the batch hasn't closed yet (no interchange fee burned).

interface RefundBody {
  shop_id: string
  // The dd_payments.id of the original charge. Required — we don't
  // accept "refund $X to last4 1234" because that's how cashiers
  // accidentally refund the wrong customer.
  original_payment_id: string
  amount_cents: number
  reason: string
}

export async function POST(req: NextRequest) {
  let body: RefundBody
  try {
    body = (await req.json()) as RefundBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.shop_id || !body.original_payment_id || !body.amount_cents || !body.reason) {
    return NextResponse.json({ error: 'shop_id, original_payment_id, amount_cents, reason required' }, { status: 400 })
  }
  if (!Number.isInteger(body.amount_cents) || body.amount_cents <= 0) {
    return NextResponse.json({ error: 'amount_cents must be a positive integer' }, { status: 400 })
  }
  // Only admin / GM can refund. Shop owners can do it through the same
  // path but field managers cannot — too easy to abuse on the floor.
  const a = await authorizeForShop(body.shop_id, {
    privilegedRoles: ['admin', 'general_manager'],
  })
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  // Verify the original charge: exists, belongs to this shop, was
  // approved, and has refund headroom left.
  const { data: original, error: origErr } = await a.svc
    .from('dd_payments')
    .select('id, shop_id, order_id, status, amount_cents, netevia_transaction_id')
    .eq('id', body.original_payment_id)
    .single()
  if (origErr || !original) {
    return NextResponse.json({ error: 'Original payment not found' }, { status: 404 })
  }
  if (original.shop_id !== body.shop_id) {
    return NextResponse.json({ error: 'Original payment is from a different shop' }, { status: 403 })
  }
  if (!['approved', 'settled'].includes(original.status)) {
    return NextResponse.json({ error: `Cannot refund a ${original.status} payment` }, { status: 400 })
  }
  if (!original.netevia_transaction_id) {
    return NextResponse.json({ error: 'Original payment has no gateway txn id (still pending?)' }, { status: 409 })
  }

  // Sum prior refunds against this charge to enforce headroom. Done at
  // the application layer (not a DB constraint) because Netevia is the
  // ultimate authority — if a prior refund silently failed our side
  // we'd rather over-refund and reconcile than block a legit one.
  const { data: priorRefunds } = await a.svc
    .from('dd_payments')
    .select('amount_cents')
    .eq('parent_payment_id', original.id)
    .eq('kind', 'refund')
    .in('status', ['approved', 'settled', 'pending'])
  const refundedSoFar = (priorRefunds ?? []).reduce((s, r) => s + r.amount_cents, 0)
  if (refundedSoFar + body.amount_cents > original.amount_cents) {
    return NextResponse.json({
      error: 'Refund exceeds remaining balance',
      original_cents: original.amount_cents,
      already_refunded_cents: refundedSoFar,
    }, { status: 400 })
  }

  // Reserve the refund ledger row in 'pending'.
  const { data: pending, error: insertErr } = await a.svc
    .from('dd_payments')
    .insert({
      order_id: original.order_id,
      shop_id: body.shop_id,
      kind: 'refund',
      status: 'pending',
      amount_cents: body.amount_cents,
      parent_payment_id: original.id,
      cashier_user_id: a.caller.id,
    })
    .select('id')
    .single()
  if (insertErr || !pending) {
    return NextResponse.json({ error: insertErr?.message ?? 'Ledger insert failed' }, { status: 500 })
  }

  const netevia = getNeteviaClientForShop(body.shop_id)
  const result = await netevia.refund({
    originalTransactionId: original.netevia_transaction_id,
    amountCents: body.amount_cents,
    reason: body.reason,
    idempotencyKey: pending.id,
  })

  if (!result.ok) {
    await a.svc
      .from('dd_payments')
      .update({
        status: result.kind === 'declined' ? 'declined' : 'error',
        response_code: result.code ?? null,
        response_message: result.message,
        gateway_payload: result.raw ?? null,
      })
      .eq('id', pending.id)
    return NextResponse.json({ error: result.message, code: result.code }, { status: 502 })
  }

  const txn = result.data
  const { error: updateErr } = await a.svc
    .from('dd_payments')
    .update({
      status: 'approved',
      netevia_transaction_id: txn.transactionId,
      netevia_auth_code: txn.authCode,
      response_code: txn.responseCode,
      response_message: txn.responseMessage,
      gateway_payload: txn.raw as any,
    })
    .eq('id', pending.id)
  if (updateErr) {
    // Gateway side succeeded; ledger needs reconciliation. Continue so
    // the customer-facing refund context row still gets written.
  }

  const isFull = refundedSoFar + body.amount_cents === original.amount_cents
  await a.svc.from('dd_payment_refunds').insert({
    payment_id: pending.id,
    original_payment_id: original.id,
    order_id: original.order_id,
    amount_cents: body.amount_cents,
    reason: body.reason,
    is_full: isFull,
    refunded_by: a.caller.id,
  })

  return NextResponse.json({
    refund: {
      id: pending.id,
      status: 'approved',
      netevia_transaction_id: txn.transactionId,
      amount_cents: body.amount_cents,
      is_full: isFull,
    },
  })
}
