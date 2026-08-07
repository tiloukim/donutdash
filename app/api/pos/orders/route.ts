import { NextRequest, NextResponse } from 'next/server'
import { authorizeForShop } from '@/lib/pos-shop-auth'
import { awardLoyaltyPoints, type LoyaltyAward } from '@/lib/loyalty'
import { POS_CARD_TRANSACTION_FEE } from '@/lib/constants'

// Create a POS walk-in order. Writes go through the service role
// (matches how customer checkout and driver flows work today).
// The caller is authenticated via Bearer token; we verify they
// actually own the shop they're billing to before inserting.

interface CartLine {
  menu_item_id: string
  name: string
  price: number
  quantity: number
  special_instructions?: string | null
  image_url?: string | null
}

interface CreateBody {
  shop_id: string
  lines: CartLine[]
  subtotal: number
  tax: number
  /** Card-payment tip in dollars. 0 (or omitted) for cash sales. */
  tip?: number
  total: number
  payment_method: 'cash' | 'card_manual' | 'card_pax'
  cash_received?: number
  change_given?: number
  /** Walk-in customer captured at the register, or null for anon walk-in. */
  customer_id?: string | null
  /** Cash discount given on this sale (dollars). 0 on card sales. */
  cash_discount_amount?: number
  /** Card processing fee added by the terminal (dollars). Server adds
   *  this to its recomputed total so the integrity check accepts the
   *  client-reported grand total. Persisted alongside cash_discount so
   *  reports can break down "what we collected as the surcharge." */
  card_surcharge_amount?: number
  /** Card brand from the terminal (VISA, MASTERCARD, AMEX, …). Lets the
   *  Transactions screen show "Mastercard 1427" instead of generic Card. */
  card_brand?: string | null
  /** Last 4 of the PAN. Indexed on dd_orders so cashiers can search by it. */
  card_last4?: string | null
  /** Gateway approval code (Dejavoo AuthCode). Persisted so reprints from
   *  the Transactions tab can still show "Authorization: XXXXXX" instead
   *  of dropping the line. */
  card_auth_code?: string | null
  /** Gateway reference # (Dejavoo PNRef). Same value as the iPOSpays
   *  terminal-side receipt's "Ref #" — lets cashiers reconcile a POS
   *  receipt against the Transactions log on the iPOSpays portal. */
  card_ref_number?: string | null
  /** Active cashier (dd_users.id). Defaults to the auth user when missing. */
  cashier_user_id?: string | null
}

export async function POST(req: NextRequest) {
  let body: CreateBody
  try {
    body = (await req.json()) as CreateBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.shop_id || !Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json({ error: 'shop_id and at least one line are required' }, { status: 400 })
  }

  // Authorize + enforce account status: owner of this shop (admin bypasses
  // ownership), and the account/shop must be active + POS-enabled. A
  // deactivated owner/shop or a POS-disabled shop is rejected with 403 — this
  // is what makes admin "deactivate" actually stop the POS from ringing sales.
  const a = await authorizeForShop(body.shop_id, { privilegedRoles: ['admin'] })
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })
  const svc = a.svc
  const profile = a.caller

  // Admin kill-switch (admin → Shops → Disable POS). Authoritative server-side
  // enforcement so a stale client that missed the flag still can't ring sales.
  const { data: shopFlags } = await svc
    .from('dd_shops')
    .select('pos_enabled')
    .eq('id', body.shop_id)
    .maybeSingle()
  if (shopFlags && shopFlags.pos_enabled === false) {
    return NextResponse.json({ error: 'POS has been disabled for this shop by an administrator.' }, { status: 403 })
  }

  // Resolve the actual cashier — the PIN switcher hands the device
  // owner's session to multiple cashiers throughout a shift. Without
  // this, staff_id always points at the device owner and per-cashier
  // shift attribution is meaningless.
  let staffId = profile.id
  if (body.cashier_user_id && body.cashier_user_id !== profile.id) {
    const { data: cashierStaff } = await svc
      .from('dd_shop_staff')
      .select('user_id')
      .eq('shop_id', body.shop_id)
      .eq('user_id', body.cashier_user_id)
      .eq('status', 'active')
      .maybeSingle()
    if (!cashierStaff) {
      return NextResponse.json({ error: 'cashier_user_id is not an active cashier at this shop' }, { status: 400 })
    }
    staffId = body.cashier_user_id
  }

  // Reconcile totals server-side. The cashier can set custom per-line
  // prices (e.g. one-off discount), but body.subtotal must equal
  // sum(price × qty) and body.total must equal subtotal + tax + tip −
  // cash_discount. Without this, a malicious / buggy client can post
  // total=$0.01 for a $50 cart and wreck the drawer reconciliation.
  const recomputedSubtotal = body.lines.reduce(
    (s, l) => s + Number(l.price) * Number(l.quantity), 0,
  )
  const tip = Number(body.tip ?? 0)
  const tax = Number(body.tax ?? 0)
  const discount = Number(body.cash_discount_amount ?? 0)
  const surcharge = Number(body.card_surcharge_amount ?? 0)
  const recomputedTotal = recomputedSubtotal + tax + tip - discount + surcharge
  const TOLERANCE = 0.01 // one cent of float wobble
  if (Math.abs(recomputedSubtotal - Number(body.subtotal)) > TOLERANCE) {
    return NextResponse.json({
      error: `subtotal mismatch: client ${body.subtotal}, server ${recomputedSubtotal.toFixed(2)}`,
    }, { status: 400 })
  }
  if (Math.abs(recomputedTotal - Number(body.total)) > TOLERANCE) {
    return NextResponse.json({
      error: `total mismatch: client ${body.total}, server ${recomputedTotal.toFixed(2)}`,
    }, { status: 400 })
  }

  const { data: order, error } = await svc
    .from('dd_orders')
    .insert({
      shop_id: body.shop_id,
      staff_id: staffId,
      customer_id: body.customer_id ?? null,
      order_type: 'pos_walkin',
      source: 'pos',
      // Walk-in sales are terminal the moment the customer pays — they're
      // already holding their food. 'delivered' is the existing terminal
      // status and keeps walk-ins out of the active-order workflow that
      // delivery/pickup orders move through.
      status: 'delivered',
      subtotal: Math.round(recomputedSubtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      tip: Math.round(tip * 100) / 100,
      total: Math.round(recomputedTotal * 100) / 100,
      payment_method: body.payment_method,
      cash_received: body.cash_received ?? null,
      change_given: body.change_given ?? null,
      cash_discount_amount: Math.round(discount * 100) / 100,
      // TODO: persist card_surcharge once we add the column. For now the
      // surcharge is folded into `total` (which IS persisted) and used
      // only for the integrity check above. Reports that need to know
      // "what % was surcharge" can derive it from (total - subtotal - tax
      // - tip + cash_discount) until the column lands.
      card_brand: body.card_brand ?? null,
      card_last4: body.card_last4 ?? null,
      card_auth_code: body.card_auth_code ?? null,
      card_ref_number: body.card_ref_number ?? null,
    })
    .select('id, short_code')
    .single()

  if (error || !order) {
    return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 })
  }

  // Bill the shop owner the per-card-transaction fee. Card only (cash is
  // exempt), logged in its own ledger — NOT added to the order total, so the
  // customer never sees or pays it. The rate is per-shop (dd_shops.pos_card_fee,
  // default $0.15); we store the amount actually charged so historical bills
  // stay right if the rate changes. Best-effort: a failed fee log must not
  // fail the sale (the order already committed + the customer paid).
  if (body.payment_method !== 'cash') {
    const { data: shopFee } = await svc
      .from('dd_shops')
      .select('pos_card_fee')
      .eq('id', body.shop_id)
      .maybeSingle()
    const fee = shopFee?.pos_card_fee != null ? Number(shopFee.pos_card_fee) : POS_CARD_TRANSACTION_FEE
    await svc.from('dd_pos_card_fees').insert({
      shop_id: body.shop_id,
      order_id: order.id,
      amount: fee,
      payment_method: body.payment_method,
    })
  }

  const items = body.lines.map((l) => ({
    order_id: order.id,
    menu_item_id: l.menu_item_id,
    name: l.name,
    price: l.price,
    quantity: l.quantity,
    special_instructions: l.special_instructions ?? null,
    image_url: l.image_url ?? null,
  }))

  const { error: itemsError } = await svc.from('dd_order_items').insert(items)
  if (itemsError) {
    // best-effort rollback of the parent row so the order doesn't linger empty
    await svc.from('dd_orders').delete().eq('id', order.id)
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  // Loyalty: award points to the attached walk-in customer (1 pt per $1 of
  // subtotal), same rules as online orders. Non-fatal — a loyalty hiccup must
  // never fail a sale the customer already paid for. Returned so the POS can
  // show "Earned X pts · <balance> total" on the receipt screen.
  let loyalty: LoyaltyAward | null = null
  if (body.customer_id) {
    try {
      loyalty = await awardLoyaltyPoints(svc, {
        userId: body.customer_id,
        orderId: order.id,
        subtotal: Math.round(recomputedSubtotal * 100) / 100,
        source: 'POS sale',
      })
    } catch (e) {
      console.error('POS loyalty award error:', e)
    }
  }

  return NextResponse.json({
    id: order.id,
    short_code: order.short_code,
    loyalty: loyalty ? { earned: loyalty.earned, balance: loyalty.points, tier: loyalty.tier } : null,
  })
}
