import { NextRequest, NextResponse } from 'next/server'
import { authorizeForShop } from '@/lib/pos-shop-auth'
import { getNeteviaClientForShop, type EntryMode } from '@/lib/netevia'

// POST /api/pos/payments/charge
//
// Runs a sale through Netevia and writes a dd_payments ledger row.
// Two entry paths:
//   1. Card-present via Dejavoo P8 — the terminal already captured the
//      card, the POS app passes `paymentToken` returned by the terminal
//      SDK. entryMode = 'present' or 'keyed'.
//   2. Card-not-present from web checkout — the browser exchanged the
//      PAN for a hosted-fields paymentToken; we never touch raw PAN.
//      entryMode = 'online'.
//
// The route is idempotent on (order_id, kind='charge'): a retry with
// the same order_id returns the existing payment row instead of
// charging twice. Net new charges without an order_id (rare — vault
// top-ups, manual sales) get a UUID idempotency key from the client.

interface ChargeBody {
  shop_id: string
  order_id?: string | null
  amount_cents: number
  tip_cents?: number
  surcharge_cents?: number
  payment_token?: string
  save_to_vault?: boolean
  description?: string
  entry_mode: EntryMode
  terminal_tpn?: string | null
  cashier_user_id?: string | null
  // Client-provided idempotency key. Required when order_id is null.
  idempotency_key?: string
}

export async function POST(req: NextRequest) {
  let body: ChargeBody
  try {
    body = (await req.json()) as ChargeBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.shop_id || !body.amount_cents || !body.entry_mode) {
    return NextResponse.json({ error: 'shop_id, amount_cents, entry_mode required' }, { status: 400 })
  }
  if (!Number.isInteger(body.amount_cents) || body.amount_cents <= 0) {
    return NextResponse.json({ error: 'amount_cents must be a positive integer' }, { status: 400 })
  }
  if (!body.order_id && !body.idempotency_key) {
    return NextResponse.json({ error: 'idempotency_key required when order_id is null' }, { status: 400 })
  }

  const a = await authorizeForShop(body.shop_id)
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  // Idempotency: if this order already has an approved charge, return
  // it rather than re-running the sale. Catches the "cashier double-tapped
  // Charge" footgun before it hits the network.
  if (body.order_id) {
    const { data: existing } = await a.svc
      .from('dd_payments')
      .select('id, status, netevia_transaction_id, netevia_auth_code, amount_cents, card_brand, card_last4')
      .eq('order_id', body.order_id)
      .eq('kind', 'charge')
      .in('status', ['approved', 'pending'])
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ payment: existing, deduplicated: true })
    }
  }

  // Reserve the ledger row in 'pending' BEFORE calling Netevia. If the
  // gateway request hangs or we crash mid-call, the row survives with
  // status=pending and the webhook can reconcile when it arrives. The
  // alternative (insert-after-success) loses the txn record entirely on
  // a crash, which is the worst possible state for accounting.
  const { data: pending, error: insertErr } = await a.svc
    .from('dd_payments')
    .insert({
      order_id: body.order_id ?? null,
      shop_id: body.shop_id,
      kind: 'charge',
      status: 'pending',
      amount_cents: body.amount_cents,
      tip_cents: body.tip_cents ?? 0,
      surcharge_cents: body.surcharge_cents ?? 0,
      entry_mode: body.entry_mode,
      terminal_tpn: body.terminal_tpn ?? null,
      cashier_user_id: body.cashier_user_id ?? a.caller.id,
    })
    .select('id')
    .single()
  if (insertErr || !pending) {
    return NextResponse.json({ error: insertErr?.message ?? 'Ledger insert failed' }, { status: 500 })
  }

  const netevia = getNeteviaClientForShop(body.shop_id)
  const result = await netevia.charge({
    amountCents: body.amount_cents,
    tipCents: body.tip_cents,
    surchargeCents: body.surcharge_cents,
    paymentToken: body.payment_token,
    saveToVault: body.save_to_vault ?? false,
    description: body.description,
    orderRef: body.order_id ?? undefined,
    entryMode: body.entry_mode,
    idempotencyKey: body.idempotency_key ?? pending.id,
  })

  if (!result.ok) {
    // Distinguish decline (normal flow, customer tries another card)
    // from system error (retry-worthy). Both update the ledger so the
    // pending row doesn't linger forever.
    await a.svc
      .from('dd_payments')
      .update({
        status: result.kind === 'declined' ? 'declined' : 'error',
        response_code: result.code ?? null,
        response_message: result.message,
        gateway_payload: result.raw ?? null,
      })
      .eq('id', pending.id)
    return NextResponse.json(
      { error: result.message, code: result.code, kind: result.kind },
      { status: result.kind === 'declined' ? 402 : 502 },
    )
  }

  const txn = result.data
  const { data: finalized, error: updateErr } = await a.svc
    .from('dd_payments')
    .update({
      status: 'approved',
      netevia_transaction_id: txn.transactionId,
      netevia_auth_code: txn.authCode,
      netevia_token: txn.token,
      netevia_token_used: body.payment_token ?? null,
      card_brand: txn.cardBrand,
      card_last4: txn.cardLast4,
      response_code: txn.responseCode,
      response_message: txn.responseMessage,
      gateway_payload: txn.raw as any,
    })
    .eq('id', pending.id)
    .select('id, status, netevia_transaction_id, netevia_auth_code, amount_cents, card_brand, card_last4, netevia_token')
    .single()
  if (updateErr || !finalized) {
    // Approved on the gateway but our ledger update failed. The webhook
    // will reconcile this row when Netevia confirms settlement — return
    // the approval to the cashier so they can finish the sale.
    return NextResponse.json({
      payment: {
        id: pending.id,
        status: 'approved',
        netevia_transaction_id: txn.transactionId,
        netevia_auth_code: txn.authCode,
        amount_cents: body.amount_cents,
        card_brand: txn.cardBrand,
        card_last4: txn.cardLast4,
      },
      warning: 'ledger_update_failed',
    })
  }

  return NextResponse.json({ payment: finalized })
}
