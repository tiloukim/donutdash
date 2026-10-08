import { NextRequest, NextResponse } from 'next/server'
import { authorizeForShop } from '@/lib/pos-shop-auth'
// Type-only use: svc comes from authorizeForShop, but its type is the one
// createServiceClient returns.
import type { createServiceClient } from '@/lib/supabase/server'
import { awardLoyaltyPoints, type LoyaltyAward } from '@/lib/loyalty'
import { POS_CARD_TRANSACTION_FEE } from '@/lib/constants'

// Create a POS walk-in order. Writes go through the service role
// (matches how customer checkout and driver flows work today).
// The caller is authenticated via Bearer token; we verify they
// actually own the shop they're billing to before inserting.

interface CartLine {
  /** Null / non-uuid for a custom keypad amount — there is no menu item. */
  menu_item_id: string | null
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
  /** Rate used to compute `tax`, as a fraction (0.0825 = 8.25%). Stored so a
   *  reprint can label the line "Tax (8.25%)" like the original slip did,
   *  and so old receipts keep their old rate after the shop's rate changes. */
  tax_rate?: number | null
  /** True when the cashier removed tax for this sale. */
  tax_exempt?: boolean
  /** Why tax was removed — Student, Vet, Church, School. */
  tax_exempt_reason?: string | null
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
  /** DonutDash Cash the customer applied, in CENTS (everything else on this
   *  body is dollars; the rewards ledger is integer cents end to end and
   *  converting at the boundary is where a cent goes missing).
   *
   *  Treated exactly like a discount in the integrity check below: the
   *  register's total already has it taken off, so the recomputation has to
   *  take it off too or every redeemed sale is refused. */
  cash_redeemed_cents?: number
  /** Order-level discount applied at the register — the discount catalog,
   *  not the cash-discount program. Deducted after subtotal and before the
   *  total, and stored so a reprint can show the line. */
  discount_amount?: number
  discount_label?: string | null
  /** Card processing fee added by the terminal (dollars). Server adds
   *  this to its recomputed total so the integrity check accepts the
   *  client-reported grand total. Persisted alongside cash_discount so
   *  reports can break down "what we collected as the surcharge." */
  card_surcharge_amount?: number
  /** Rate the convenience fee was charged at, as a PERCENT (3.5 = 3.5%).
   *  Stored so a reprint shows what the customer actually paid rather than
   *  whatever the shop charges today. */
  card_surcharge_pct?: number | null
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
  /** Idempotency key from the register's offline queue. Optional — older
   *  builds don't send one, and those keep the previous behaviour exactly.
   *  When present, a repeat of the same key returns the original order
   *  instead of creating a second one. */
  client_order_id?: string | null
}

/**
 * Close the charge intent for a recorded sale.
 *
 * Matched on client_order_id, which the register now carries from before the
 * card is read through to the posted order — so this is an exact join, not a
 * guess from amount and timestamp.
 *
 * Deliberately swallows its own errors. An order that is already safely
 * written must not be failed because a reconciliation row could not be
 * updated; the cost of that is one false entry in a report, and the cost of
 * the alternative is a sale rejected after the customer has paid.
 */
async function resolveChargeIntent(
  svc: ReturnType<typeof createServiceClient>,
  clientOrderId: string | null,
  shopId: string,
  orderId: string,
) {
  if (!clientOrderId) return
  try {
    await svc
      .from('dd_pos_charge_intents')
      .update({ order_id: orderId, resolved_at: new Date().toISOString() })
      .eq('client_order_id', clientOrderId)
      .eq('shop_id', shopId)
  } catch (e) {
    console.error('[orders] could not resolve charge intent:', e)
  }
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
  // Order-level discount. Its absence here is what rejected every
  // discounted sale: the register sends the GROSS subtotal with the items
  // and a total that already has the discount taken off, so leaving the
  // discount out of this sum made the two disagree by exactly the discount.
  // Order 46ADB ($67.59, 5% off) died on "total mismatch: client 67.59,
  // server 70.77" — 70.77 − 67.59 = 3.18 = the discount — and by then the
  // card had already been charged.
  const orderDiscount = Number(body.discount_amount ?? 0)
  // Cents on the wire, dollars in this sum. Rounded to cents first so the
  // division cannot introduce a fraction the comparison then trips on.
  const cashRedeemed = Math.max(0, Math.round(Number(body.cash_redeemed_cents ?? 0))) / 100
  const surcharge = Number(body.card_surcharge_amount ?? 0)
  const recomputedTotal = recomputedSubtotal + tax + tip - discount - orderDiscount - cashRedeemed + surcharge
  const TOLERANCE = 0.01 // one cent of float wobble
  const mismatches: string[] = []
  if (Math.abs(recomputedSubtotal - Number(body.subtotal)) > TOLERANCE) {
    mismatches.push(`subtotal mismatch: client ${body.subtotal}, server ${recomputedSubtotal.toFixed(2)}`)
  }
  if (Math.abs(recomputedTotal - Number(body.total)) > TOLERANCE) {
    mismatches.push(`total mismatch: client ${body.total}, server ${recomputedTotal.toFixed(2)}`)
  }

  // An auth code means the terminal already took the money. Refusing the
  // sale now does not undo the charge — it only throws away the record of
  // it, and the register drops 4xx rather than retrying them, so the sale
  // is gone for good. That is how order 46ADB vanished, and how a $3.36
  // Discover sale on 7 Oct 2026 left the POS $3.36 short of batch 029.
  //
  // So a charged sale is always recorded. It is recorded at the amount the
  // customer was actually charged — the client total, which is what the
  // terminal ran — because the server's recomputation is the figure in
  // doubt, and writing it would misstate the till. The disagreement is
  // kept on the row and an admin is told.
  //
  // Without an auth code no money has moved, so the check still refuses:
  // that is a client bug worth surfacing, and nothing is lost by failing.
  const alreadyCharged = typeof body.card_auth_code === 'string' && body.card_auth_code.trim() !== ''
  if (mismatches.length > 0 && !alreadyCharged) {
    return NextResponse.json({ error: mismatches[0] }, { status: 400 })
  }
  const reconcileFlag = mismatches.length > 0 ? 'total_mismatch' : null
  const reconcileNote = mismatches.length > 0 ? mismatches.join('; ') : null
  const recordedTotal = reconcileFlag ? Number(body.total) : recomputedTotal

  // Trimmed and length-capped before it reaches an indexed column. The value
  // is device-generated, so treat it as untrusted input like any other field.
  const rawKey = typeof body.client_order_id === 'string' ? body.client_order_id.trim() : ''
  const clientOrderId = rawKey ? rawKey.slice(0, 64) : null

  const orderRow: Record<string, unknown> = {
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
      // Rate, not just the dollars — see supabase/order-tax-rate.sql. Left
      // null when the client doesn't send one so the receipt falls back to a
      // bare "Tax" line rather than printing a confident 0%.
      tax_rate: body.tax_rate != null ? Number(body.tax_rate) : null,
      // Recorded because tax = 0 on its own cannot tell an exempt sale from
      // a shop that charges no tax, and "why wasn't tax charged" is the
      // question that gets asked at filing time.
      tax_exempt: !!body.tax_exempt,
      tax_exempt_reason: body.tax_exempt ? (body.tax_exempt_reason ?? null) : null,
      tip: Math.round(tip * 100) / 100,
      total: Math.round(recordedTotal * 100) / 100,
      payment_method: body.payment_method,
      cash_received: body.cash_received ?? null,
      change_given: body.change_given ?? null,
      cash_discount_amount: Math.round(discount * 100) / 100,
      // Persisted so the reprint shows the discount the customer was given,
      // and so "what did we give away this month" is answerable at all.
      discount_amount: Math.round(orderDiscount * 100) / 100,
      cash_redeemed_cents: Math.round(cashRedeemed * 100),
      discount_label: body.discount_label ?? null,
      // Card fee as reported by the gateway, stored explicitly rather than
      // folded into `total` and reverse-engineered later (see
      // supabase/card-surcharge.sql). Deriving it arithmetically is what
      // let a fabricated 4% go unnoticed in reports.
      card_surcharge_amount: Math.round(surcharge * 100) / 100,
      card_surcharge_pct: body.card_surcharge_pct != null ? Number(body.card_surcharge_pct) : null,
      card_brand: body.card_brand ?? null,
      card_last4: body.card_last4 ?? null,
      card_auth_code: body.card_auth_code ?? null,
      card_ref_number: body.card_ref_number ?? null,
      client_order_id: clientOrderId,
      reconcile_flag: reconcileFlag,
      reconcile_note: reconcileNote,
  }

  // The reconcile columns ship with supabase/card-sale-reconciliation.sql.
  // If the code is live before the migration is, dropping them and trying
  // again keeps every sale recordable — a sale is worth more than the flag
  // on it. 42703 is "column does not exist".
  let { data: order, error } = await svc
    .from('dd_orders').insert(orderRow).select('id, short_code').single()
  if (error && (error as { code?: string }).code === '42703') {
    delete orderRow.reconcile_flag
    delete orderRow.reconcile_note
    console.error('[pos/orders] reconcile columns missing — run supabase/card-sale-reconciliation.sql')
    ;({ data: order, error } = await svc
      .from('dd_orders').insert(orderRow).select('id, short_code').single())
  }

  // A repeat of a key we already have is a REPLAY, not a failure.
  //
  // The register posts with a 15s abort and queues anything that times out.
  // When the server actually received that sale, the replay arrives here as
  // a unique violation on (shop_id, client_order_id) — and the honest answer
  // is the order that already exists, not an error. The cashier's copy syncs,
  // the queue entry clears, and the sale is recorded once.
  //
  // Returning 200 with the original row matters as much as the dedup itself:
  // a 409 would leave the entry in the queue retrying forever against a
  // server that is never going to accept it.
  if (error && error.code === '23505' && clientOrderId) {
    const { data: existing } = await svc
      .from('dd_orders')
      .select('id, short_code')
      .eq('shop_id', body.shop_id)
      .eq('client_order_id', clientOrderId)
      .maybeSingle()
    if (existing) {
      // No items insert, no fee ledger row, no loyalty award — all of that
      // ran on the first request. Re-running any of it is the duplicate
      // this route exists to prevent, wearing a different hat.
      // Resolve here too. A replay means the FIRST attempt is what created
      // the order, and if its own resolve call was the thing that failed, the
      // intent would otherwise sit in the unrecorded-charges report forever
      // describing a sale that is sitting in the table perfectly fine.
      await resolveChargeIntent(svc, clientOrderId, body.shop_id, existing.id)
      return NextResponse.json({ id: existing.id, short_code: existing.short_code, duplicate: true })
    }
  }

  if (error || !order) {
    return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 })
  }

  // The sale exists. Whatever the register attempted is now accounted for.
  await resolveChargeIntent(svc, clientOrderId, body.shop_id, order.id)

  // Record the processor's flat per-card fee for reconciliation. Card only
  // (cash is exempt), logged in its own ledger — NOT added to the order
  // total, so the customer never sees or pays it.
  //
  // This does NOT bill anyone. The processor (Netevia / iPOSpays) deducts
  // 3.5% + $0.15 from the deposit directly; this ledger exists so daily
  // totals can be reconciled against the statement. No payout path reads it.
  //
  // Note it captures only the FLAT half — the 3.5% (dd_shops.pos_card_fee_pct)
  // is reporting-only and is not written here, because /api/pos/card-fees/daily
  // is consumed by an external billing pull (POS_BILLING_KEY) and changing
  // what that returns needs the consumer's agreement first.
  //
  // The rate is per-shop (dd_shops.pos_card_fee, default $0.15); we store the
  // amount in effect at the time so history stays right if the rate changes.
  // Logged AFTER the items insert, so a sale that fails to save is never
  // billed. Writing it earlier left orphan fee rows (order_id nulled by the
  // FK when the failed order was rolled back) — three of them the day the
  // custom-item bug was found, each for a sale that no longer existed.
  // Best-effort from here: a failed log must not fail a sale the customer
  // has already paid for.

  // A custom keypad line has no menu item behind it — the POS synthesises a
  // client-side id ("custom-1789080644182") purely to keep separate custom
  // lines from merging in the cart. That is not a uuid, and sending it made
  // Postgres reject the whole insert, rolling back the order: no sale
  // containing a custom amount could be completed. Anything that isn't a uuid
  // is stored as NULL (see supabase/order-items-custom-lines.sql).
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const items = body.lines.map((l) => ({
    order_id: order.id,
    menu_item_id: UUID_RE.test(String(l.menu_item_id ?? '')) ? l.menu_item_id : null,
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

  if (body.payment_method !== 'cash') {
    const { data: shopFee } = await svc
      .from('dd_shops')
      .select('pos_card_fee, pos_card_fee_pct')
      .eq('id', body.shop_id)
      .maybeSingle()
    const flat = shopFee?.pos_card_fee != null ? Number(shopFee.pos_card_fee) : POS_CARD_TRANSACTION_FEE
    // The processor's cut has two halves and this ledger only ever recorded
    // the flat one, so every reconciliation total ran 3.5% of card volume
    // light. pos_card_fee_pct is stored as a PERCENT (3.5), not a fraction.
    const pct = shopFee?.pos_card_fee_pct != null ? Number(shopFee.pos_card_fee_pct) : 0
    // Percentage applies to what the processor actually settles — the full
    // amount run on the card, surcharge and tip included — not the subtotal.
    const base = Math.round(recomputedTotal * 100) / 100
    const amount = Math.round((flat + base * (pct / 100)) * 100) / 100
    await svc.from('dd_pos_card_fees').insert({
      shop_id: body.shop_id,
      order_id: order.id,
      amount,
      fee_flat: flat,
      fee_pct: pct,
      base_amount: base,
      payment_method: body.payment_method,
    })
  }

  // DonutDash Cash: settle the redemption, then the earning.
  //
  // In that order, and both AFTER the order row exists, because the earn is
  // computed from the order's own columns — including the redemption, which
  // must already be on the row or the customer earns on money they did not
  // spend.
  //
  // Non-fatal, like loyalty below: the customer has already paid, and a
  // rewards hiccup must never fail a sale. Both functions are idempotent on
  // the order, so the retry path and the offline replay re-run them safely.
  let cash: { redeemed_cents: number; earned_cents: number; balance_cents: number } | null = null
  if (body.customer_id) {
    try {
      // Resolve through any merge, so a customer who was deduplicated earns
      // into the surviving wallet rather than a record nobody reads.
      const { data: canonical } = await svc
        .rpc('dd_customer_canonical', { p_user: body.customer_id })
        .single<string>()
      const customerId = canonical ?? body.customer_id

      if (cashRedeemed > 0) {
        const requestedCents = Math.round(cashRedeemed * 100)
        const { data: redeemRow } = await svc.rpc('dd_cash_redeem', {
          p_order_id: order.id,
          p_customer: customerId,
          p_shop_id: body.shop_id,
          p_requested_cents: requestedCents,
        }).maybeSingle<{ amount_cents: number }>()

        // What the wallet ACTUALLY gave up, which is not always what the
        // register asked for.
        //
        // dd_cash_redeem clamps the request to the real balance, the eligible
        // merchandise and the shop's per-order cap, and this call used to
        // throw its answer away. So when a register asked for more than the
        // customer had — a stale quote carried over from a previous sale —
        // the ledger was correctly debited for what existed while the ORDER
        // kept claiming the larger figure it had already discounted. Order
        // 19FDC recorded $1.38 against a wallet holding $0.29; the customer's
        // balance was never over-drawn, but the shop quietly absorbed $1.09
        // and nothing anywhere said so.
        //
        // The total is NOT rewritten: it is what the card was charged, and
        // that is a fact. What gets corrected is the claim about where the
        // discount came from, and the gap is flagged so somebody can see it.
        const actualCents = Math.abs(Number(redeemRow?.amount_cents ?? 0))
        if (actualCents !== requestedCents) {
          const shortfall = (requestedCents - actualCents) / 100
          // FLAGGED, not rewritten.
          //
          // cash_redeemed_cents is part of the total's identity — this route
          // validates total == subtotal + tax + tip - discount - cashRedeemed
          // + surcharge and refuses a sale whose parts disagree. Correcting
          // the column to the funded figure would leave total no longer
          // explained by its own parts, breaking that invariant on exactly
          // the orders that most need to be legible.
          //
          // So the order keeps the discount the customer actually received,
          // which is what the card was charged and therefore true, and the
          // shortfall is recorded as what it is: a discount the wallet did
          // not fund, absorbed by the shop.
          await svc.from('dd_orders').update({
            reconcile_flag: 'redeem_shortfall',
            reconcile_note:
              `Register applied ${(requestedCents / 100).toFixed(2)} of DonutDash Cash but the ` +
              `wallet only funded ${(actualCents / 100).toFixed(2)}. ` +
              `${shortfall.toFixed(2)} of this sale's discount was not backed by a balance.`,
          }).eq('id', order.id)
        }
      }
      await svc.rpc('dd_cash_earn', { p_order_id: order.id })

      // This shop's wallet. Without the shop filter maybeSingle() would
      // throw once a customer holds a balance at more than one shop, and
      // before that it would have reported another shop's balance on this
      // shop's receipt.
      const { data: w } = await svc
        .from('dd_cash_wallets')
        .select('balance_cents')
        .eq('customer_id', customerId)
        .eq('shop_id', body.shop_id)
        .maybeSingle()
      const { data: rows } = await svc
        .from('dd_cash_ledger')
        .select('transaction_type, amount_cents')
        .eq('order_id', order.id)
      const earned = (rows ?? []).filter(r => r.transaction_type === 'EARN')
        .reduce((n, r) => n + Number(r.amount_cents), 0)
      const redeemed = (rows ?? []).filter(r => r.transaction_type === 'REDEEM')
        .reduce((n, r) => n - Number(r.amount_cents), 0)
      cash = {
        redeemed_cents: redeemed,
        earned_cents: earned,
        balance_cents: Number(w?.balance_cents ?? 0),
      }
    } catch (e) {
      console.error('DonutDash Cash error:', e)
    }
  }

  // Loyalty: award points to the attached walk-in customer (1 pt per $1 of
  // subtotal), same rules as online orders. Non-fatal — a loyalty hiccup must
  // never fail a sale the customer already paid for. Returned so the POS can
  // show "Earned X pts · <balance> total" on the receipt screen.
  //
  // Superseded by DonutDash Cash and kept running only so the online channel
  // and the tier badges keep working until that side is migrated too. Retire
  // this block, not the tables, once online earns Cash as well.
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
    cash,
  })
}
