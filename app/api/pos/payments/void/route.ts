import { NextRequest, NextResponse } from 'next/server'
import { authorizeForShop } from '@/lib/pos-shop-auth'
import { getNeteviaClientForShop } from '@/lib/netevia'

// POST /api/pos/payments/void
//
// Voids an approved-but-not-yet-settled charge. Use this when the
// cashier rings up the wrong amount and catches it before batch close —
// no interchange fee is charged on a void, vs ~2% on a refund of the
// same amount post-settlement. After batch close, this returns 409 and
// the caller should fall back to /refund.

interface VoidBody {
  shop_id: string
  payment_id: string
  reason: string
}

export async function POST(req: NextRequest) {
  let body: VoidBody
  try {
    body = (await req.json()) as VoidBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.shop_id || !body.payment_id || !body.reason) {
    return NextResponse.json({ error: 'shop_id, payment_id, reason required' }, { status: 400 })
  }

  const a = await authorizeForShop(body.shop_id, {
    privilegedRoles: ['admin', 'general_manager', 'field_manager'],
  })
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  const { data: payment, error: payErr } = await a.svc
    .from('dd_payments')
    .select('id, shop_id, kind, status, batch_id, netevia_transaction_id')
    .eq('id', body.payment_id)
    .single()
  if (payErr || !payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }
  if (payment.shop_id !== body.shop_id) {
    return NextResponse.json({ error: 'Payment is from a different shop' }, { status: 403 })
  }
  if (payment.status !== 'approved') {
    return NextResponse.json({ error: `Cannot void a ${payment.status} payment` }, { status: 400 })
  }
  if (payment.batch_id) {
    // Already settled — caller must use /refund. 409 (Conflict) chosen
    // over 400 so the POS app can branch on status code alone.
    return NextResponse.json({
      error: 'Payment is already settled; use /refund instead',
      fallback: 'refund',
    }, { status: 409 })
  }
  if (!payment.netevia_transaction_id) {
    return NextResponse.json({ error: 'Payment has no gateway txn id' }, { status: 409 })
  }
  if (payment.kind !== 'charge' && payment.kind !== 'auth') {
    return NextResponse.json({ error: `Cannot void a ${payment.kind} (only charge or auth)` }, { status: 400 })
  }

  const netevia = getNeteviaClientForShop(body.shop_id)
  const result = await netevia.void({
    transactionId: payment.netevia_transaction_id,
    reason: body.reason,
    idempotencyKey: payment.id,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.message, code: result.code }, { status: 502 })
  }

  // Voids modify the original row in-place (no separate ledger row
  // because the gateway txn id stays the same — just status flips).
  // This differs from refunds, which DO get their own ledger row
  // because they're a fresh gateway txn with their own id.
  await a.svc
    .from('dd_payments')
    .update({
      status: 'voided',
      response_code: result.data.responseCode,
      response_message: result.data.responseMessage,
      gateway_payload: result.data.raw as any,
    })
    .eq('id', payment.id)

  return NextResponse.json({ payment_id: payment.id, status: 'voided' })
}
