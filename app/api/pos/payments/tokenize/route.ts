import { NextRequest, NextResponse } from 'next/server'
import { authorizeForShop } from '@/lib/pos-shop-auth'
import { getNeteviaClientForShop } from '@/lib/netevia'

// POST /api/pos/payments/tokenize
//
// Exchanges a single-use Netevia hosted-fields token for a permanent
// vault token, then writes it to dd_payments as a kind='auth' row with
// amount_cents=0. This is how card-on-file gets saved without running
// a charge — the row is the audit trail for "shop X tokenized a card
// for customer Y on date Z" without polluting the sale ledger.
//
// Used by:
//   - Online checkout "save this card for next time" toggle
//   - POS "save card for tab" flow (rare; mostly catering / corporate)
//
// We never receive raw PAN here — the browser (or terminal SDK) talks
// directly to Netevia's hosted fields and hands back a payment_token.

interface TokenizeBody {
  shop_id: string
  payment_token: string
  // Optional customer this card belongs to. When set, the resulting
  // vault token also gets written to dd_user_payment_methods (a future
  // table — TODO when card-on-file ships). For now we just stash it
  // on dd_payments so it isn't lost.
  customer_user_id?: string | null
}

export async function POST(req: NextRequest) {
  let body: TokenizeBody
  try {
    body = (await req.json()) as TokenizeBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.shop_id || !body.payment_token) {
    return NextResponse.json({ error: 'shop_id and payment_token required' }, { status: 400 })
  }

  const a = await authorizeForShop(body.shop_id)
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  const netevia = getNeteviaClientForShop(body.shop_id)
  const result = await netevia.tokenize({
    paymentToken: body.payment_token,
    customerRef: body.customer_user_id ?? undefined,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.message, code: result.code }, { status: 502 })
  }

  const vault = result.data
  const { data: payment, error: insertErr } = await a.svc
    .from('dd_payments')
    .insert({
      shop_id: body.shop_id,
      kind: 'auth',
      status: 'approved',
      amount_cents: 0,
      entry_mode: 'online',
      netevia_token: vault.token,
      netevia_token_used: body.payment_token,
      card_brand: vault.cardBrand,
      card_last4: vault.cardLast4,
      cashier_user_id: a.caller.id,
    })
    .select('id, netevia_token, card_brand, card_last4')
    .single()

  if (insertErr || !payment) {
    // Token exists in Netevia's vault but we lost the audit row. Return
    // the token anyway so the client can save it — better than dropping
    // the customer's saved-card request entirely.
    return NextResponse.json({
      vault: {
        token: vault.token,
        card_brand: vault.cardBrand,
        card_last4: vault.cardLast4,
        expiration_month: vault.expirationMonth,
        expiration_year: vault.expirationYear,
      },
      warning: 'ledger_insert_failed',
    })
  }

  return NextResponse.json({
    vault: {
      payment_id: payment.id,
      token: payment.netevia_token,
      card_brand: payment.card_brand,
      card_last4: payment.card_last4,
      expiration_month: vault.expirationMonth,
      expiration_year: vault.expirationYear,
    },
  })
}
