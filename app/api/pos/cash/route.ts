import { NextRequest, NextResponse } from 'next/server'
import { authorizeForShop } from '@/lib/pos-shop-auth'
import { normalizePhone, maskPhone } from '@/lib/phone'

// POST /api/pos/cash — find or create a customer by phone, and tell the
// register what their DonutDash Cash is worth on THIS sale.
//
// One call rather than three, because it happens at the counter with somebody
// waiting: the cashier types a number and needs the name, the balance, what
// this sale would earn and the most that can be applied to it — all before
// they can say anything useful out loud.
//
// The register is never trusted with any of those figures. It sends a phone
// number and an eligible subtotal; everything else is computed here from the
// shop's own settings and the wallet's own rows.

export const dynamic = 'force-dynamic'

interface Body {
  shop_id: string
  phone: string
  /** Merchandise after discounts, in cents. Used to quote the earn and cap
   *  the redemption — never to decide what is actually credited. */
  eligible_cents?: number
  /** Create the customer when the number is unknown. The lookup path leaves
   *  this false so a mistyped number does not litter the customer list. */
  create?: boolean
  name?: string
}

export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const a = await authorizeForShop(body.shop_id)
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })
  const svc = a.svc

  const phone = normalizePhone(body.phone)
  // A call with NO phone at all is a configuration probe: the register asking
  // what this shop's rewards settings are before it has anything to look up.
  // Distinguished from a phone it could not parse, which is a real error and
  // still rejected — otherwise a mistyped number would silently read as
  // "tell me the settings" and the cashier would see nothing happen.
  const probe = !body.phone
  if (!phone && !probe) {
    return NextResponse.json({ error: 'Enter a 10-digit mobile number.' }, { status: 400 })
  }

  const { data: shop } = await svc
    .from('dd_shops')
    .select('rewards_enabled, reward_new_customer_bps, reward_standard_bps, reward_min_purchase_cents, reward_max_redeem_cents, reward_prompt_customer')
    .eq('id', body.shop_id)
    .maybeSingle()

  if (!shop?.rewards_enabled) {
    return NextResponse.json({ enabled: false })
  }
  // Whether the register should put the pad on the customer's screen by
  // itself. Returned with every lookup so the panel does not need a second
  // call to find out, and so the setting takes effect without a new build.
  const promptCustomer = !!shop.reward_prompt_customer

  if (probe) {
    return NextResponse.json({ enabled: true, found: false, prompt_customer: promptCustomer })
  }

  // Live records only. A merged duplicate is excluded by the same condition
  // the unique index uses, so a number can only ever resolve to one person.
  let { data: customer } = await svc
    .from('dd_users')
    .select('id, name, phone')
    .eq('role', 'customer')
    .eq('phone_normalized', phone!)
    .is('merged_into', null)
    .maybeSingle()

  if (!customer) {
    if (!body.create) {
      // Say what a NEW customer would earn, from this shop's own setting.
      //
      // The customer screen used to print "earning 5% today" as a literal,
      // which was accidentally true only because Top Donuts happens to be set
      // to 500 bps. Now that a shop sets its own rate, a shop on 3% would have
      // promised 5% on the customer's screen and awarded 3% at the till. The
      // register cannot state a rate it has not been told, so it is sent one.
      const newBps = Number(shop.reward_new_customer_bps ?? 0)
      const eligibleNow = Math.max(0, Math.floor(Number(body.eligible_cents ?? 0)))
      const earnsNow = eligibleNow >= (shop.reward_min_purchase_cents ?? 0)
        ? Math.floor((eligibleNow * newBps + 5000) / 10000)
        : 0
      return NextResponse.json({
        enabled: true,
        found: false,
        prompt_customer: promptCustomer,
        new_customer_bps: newBps,
        earn: { is_new_customer: true, rate_bps: newBps, will_earn_cents: earnsNow },
      })
    }
    const { data: created, error } = await svc
      .from('dd_users')
      .insert({
        name: body.name?.trim() || 'Guest',
        phone: body.phone,
        role: 'customer',
        is_active: true,
      })
      .select('id, name, phone')
      .single()
    // A race on the unique index means somebody else just created them;
    // read theirs rather than failing the sale.
    if (error) {
      const { data: raced } = await svc
        .from('dd_users')
        .select('id, name, phone')
        .eq('role', 'customer')
        .eq('phone_normalized', phone)
        .is('merged_into', null)
        .maybeSingle()
      if (!raced) return NextResponse.json({ error: error.message }, { status: 500 })
      customer = raced
    } else {
      customer = created
    }
  }

  // Wallet, created on first sight so a new customer has somewhere to earn.
  const { data: wallet } = await svc
    .rpc('dd_cash_wallet_for', { p_customer: customer!.id, p_shop: body.shop_id })
    .maybeSingle<{ balance_cents: number; recoverable_offset_cents: number }>()

  const balance = Number(wallet?.balance_cents ?? 0)
  const offset = Number(wallet?.recoverable_offset_cents ?? 0)

  // Has this customer ever earned AT THIS SHOP? Decides the rate, and it is
  // the ledger that answers — a customer who earned and spent it all is not
  // new. Scoped to the shop to match dd_cash_earn: balances are per shop, so
  // a regular at one shop is genuinely a new customer at the next, and the
  // quote the cashier reads out has to agree with what the sale will award.
  const { count: earnCount } = await svc
    .from('dd_cash_ledger')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customer!.id)
    .eq('shop_id', body.shop_id)
    .eq('transaction_type', 'EARN')

  const isNew = (earnCount ?? 0) === 0
  const bps = isNew ? shop.reward_new_customer_bps : shop.reward_standard_bps

  const eligible = Math.max(0, Math.floor(Number(body.eligible_cents ?? 0)))
  const meetsMinimum = eligible >= (shop.reward_min_purchase_cents ?? 0)

  // Quote only. The real figure is computed again inside dd_cash_earn when
  // the sale is recorded, from the order's own numbers.
  const grossEarn = meetsMinimum ? Math.floor((eligible * bps + 5000) / 10000) : 0
  // What they would actually see credited, after any refund shortfall is
  // recovered. Quoting the gross would promise money that will not arrive.
  const willEarn = Math.max(0, grossEarn - Math.min(grossEarn, offset))

  const maxRedeem = Math.min(
    balance,
    eligible,
    shop.reward_max_redeem_cents ?? Number.MAX_SAFE_INTEGER,
  )

  return NextResponse.json({
    enabled: true,
    found: true,
    prompt_customer: promptCustomer,
    customer: {
      id: customer!.id,
      name: customer!.name,
      // Masked. A counter-facing screen and anything that logs this response
      // have no use for the middle three digits.
      phone_masked: maskPhone(customer!.phone),
    },
    wallet: {
      balance_cents: balance,
      recoverable_offset_cents: offset,
    },
    earn: {
      is_new_customer: isNew,
      rate_bps: bps,
      will_earn_cents: willEarn,
    },
    redeem: {
      max_cents: Math.max(0, maxRedeem),
    },
  })
}
