import { NextRequest, NextResponse } from 'next/server'
import { authorizeForShop } from '@/lib/pos-shop-auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * "A card charge is about to happen / has just answered."
 *
 * POST opens an intent before the terminal is touched; PATCH closes it with
 * what the terminal said. Together they leave a server-side trace of every
 * attempted charge, so a charge that approves and never becomes an order is
 * something we can LIST rather than something we discover when a customer
 * complains or a settlement is read by hand.
 *
 * Both are best effort by design. The register is told to ignore failures
 * here, and that is the right trade: a bookkeeping record must never be able
 * to stop a sale. Losing an intent costs us a line in a reconciliation
 * report; blocking the register costs the shop its morning.
 */

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.shop_id || !body?.client_order_id) {
    return NextResponse.json({ error: 'shop_id and client_order_id are required' }, { status: 400 })
  }
  const a = await authorizeForShop(body.shop_id)
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  const cents = Math.round(Number(body.amount_cents))
  if (!Number.isFinite(cents) || cents < 0) {
    return NextResponse.json({ error: 'amount_cents must be a non-negative number' }, { status: 400 })
  }

  // The cashier comes from the authenticated caller, never from the request
  // body. The register has no business asserting who it is, and the orders
  // route already resolves it this way — taking it from the body here would
  // let a device attribute a charge to someone else.
  const staffId = a.caller?.id ?? null

  const svc = createServiceClient()
  // upsert, not insert: the register retries on a flaky network, and a second
  // attempt for the same sale must update the existing row rather than fail
  // on the unique index and make the caller think the intent was never
  // recorded.
  const { error } = await svc
    .from('dd_pos_charge_intents')
    .upsert({
      client_order_id: String(body.client_order_id),
      shop_id: body.shop_id,
      staff_id: staffId,
      amount_cents: cents,
    }, { onConflict: 'client_order_id' })

  if (error) {
    console.error('[charge-intent] open failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

/** What the terminal answered. Never creates a row: if the open did not land,
 *  there is nothing to attach this to, and inventing a row here would record
 *  an intent that was never actually opened. */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.shop_id || !body?.client_order_id) {
    return NextResponse.json({ error: 'shop_id and client_order_id are required' }, { status: 400 })
  }
  const a = await authorizeForShop(body.shop_id)
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  const charged = Number(body.charged_cents)
  const svc = createServiceClient()
  const { error } = await svc
    .from('dd_pos_charge_intents')
    .update({
      approved: body.approved === true,
      auth_code: body.auth_code ?? null,
      ref_number: body.ref_number ?? null,
      card_last4: body.card_last4 ?? null,
      charged_cents: Number.isFinite(charged) ? Math.round(charged) : null,
      terminal_at: new Date().toISOString(),
    })
    .eq('client_order_id', String(body.client_order_id))
    .eq('shop_id', body.shop_id)

  if (error) {
    console.error('[charge-intent] close failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
