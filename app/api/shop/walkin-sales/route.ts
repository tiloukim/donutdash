import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerShop as getActiveShop } from '@/lib/shop-auth'

// GET /api/shop/walkin-sales?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=n
//
// Walk-in POS transactions for the signed-in owner's shop.
//
// /api/shop/orders deliberately filters to delivery + pickup, because that
// dashboard drives an accept/prep/ready workflow that walk-ins have no part
// in — they're terminal the moment the customer pays. The side effect was
// that walk-in sales appeared nowhere on the web at all: they fed the
// stats, earnings and bookkeeping TOTALS, but the individual transactions
// were only ever visible on the register's own screen. An owner away from
// the shop could see that $240 came in and not what any of it was.
//
// Read-only on purpose. Refund and reprint stay on the register: reprint
// needs the printer, and a refund issued from a phone with no drawer open
// and no customer present is a reconciliation problem, not a feature.

export const dynamic = 'force-dynamic'

// Cap on rows returned. A busy Saturday is a few hundred walk-ins; this is
// generous for a phone screen while stopping an unbounded date range from
// pulling a year of sales into one response.
const MAX_LIMIT = 500
const DEFAULT_LIMIT = 100

// 'YYYY-MM-DD' in the viewer's local reckoning -> UTC instants.
//
// Deliberately NOT `new Date('YYYY-MM-DD')`, which parses as UTC midnight and
// shifts the window a day for anyone west of Greenwich — Tyler is UTC-5/-6, so
// "today" would start at 6pm yesterday and a morning's sales would land on the
// wrong day. offsetMinutes comes from the client's own clock.
function dayRange(from: string, to: string, offsetMinutes: number) {
  const mk = (d: string, endOfDay: boolean) => {
    const [y, m, day] = d.split('-').map(Number)
    if (!y || !m || !day) return null
    const localMs = Date.UTC(y, m - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0)
    return new Date(localMs + offsetMinutes * 60_000)
  }
  const start = mk(from, false)
  const end = mk(to, true)
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  return { start: start.toISOString(), end: end.toISOString() }
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const shop = await getActiveShop(svc, ddUser.id)
  if (!shop) return NextResponse.json({ error: 'No shop' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const today = new Date().toISOString().slice(0, 10)
  const from = searchParams.get('from') || today
  const to = searchParams.get('to') || from
  // Minutes to ADD to a local wall time to reach UTC (JS getTimezoneOffset
  // sign). Defaults to 0 so a caller that omits it gets UTC days rather than
  // an error.
  const offsetMinutes = Number(searchParams.get('tz_offset') ?? 0) || 0
  const limit = Math.min(Number(searchParams.get('limit')) || DEFAULT_LIMIT, MAX_LIMIT)

  const range = dayRange(from, to, offsetMinutes)
  if (!range) return NextResponse.json({ error: 'from/to must be YYYY-MM-DD' }, { status: 400 })

  const { data, error } = await svc
    .from('dd_orders')
    .select(`
      id, short_code, status, created_at,
      subtotal, tax, tax_rate, tip, total, refund_amount,
      cash_discount_amount, card_surcharge_amount,
      payment_method, cash_received, change_given,
      card_brand, card_last4, card_auth_code, card_ref_number,
      staff_id,
      items:dd_order_items(name, quantity, price)
    `)
    .eq('shop_id', shop.id)
    .eq('order_type', 'pos_walkin')
    .gte('created_at', range.start)
    .lte('created_at', range.end)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data ?? []

  // The processor's cut on this day's card sales, as recorded per order when
  // the sale was rung. Keyed by order so it covers exactly the sales listed
  // above, including any the page's limit truncated away — which keeps the
  // figure honest rather than quietly partial.
  const orderIds = rows.map((r) => r.id)
  let shopFees = 0
  if (orderIds.length > 0) {
    const { data: feeRows } = await svc
      .from('dd_pos_card_fees')
      .select('amount')
      .in('order_id', orderIds)
    shopFees = Math.round((feeRows ?? []).reduce((t, f) => t + Number(f.amount || 0), 0) * 100) / 100
  }

  // Cashier names, resolved in one query rather than a join — dd_orders.staff_id
  // points at dd_users and a nested select here would re-fetch the same handful
  // of staff for every row.
  const staffIds = [...new Set(rows.map((r) => r.staff_id).filter(Boolean))] as string[]
  const names = new Map<string, string>()
  if (staffIds.length) {
    const { data: staff } = await svc.from('dd_users').select('id, name').in('id', staffIds)
    for (const s of staff ?? []) names.set(s.id, s.name)
  }

  // Refunded sales still happened; they're kept in the list and flagged, since
  // an owner scanning the day wants to SEE the refund, not find a gap where a
  // sale used to be.
  const sales = rows.map((o) => {
    const refund = Number(o.refund_amount || 0)
    return {
      id: o.id,
      shortCode: o.short_code,
      at: o.created_at,
      cashier: o.staff_id ? names.get(o.staff_id) ?? null : null,
      paymentMethod: o.payment_method,
      cardBrand: o.card_brand,
      cardLast4: o.card_last4,
      authCode: o.card_auth_code,
      refNumber: o.card_ref_number,
      subtotal: Number(o.subtotal || 0),
      tax: Number(o.tax || 0),
      taxRate: o.tax_rate != null ? Number(o.tax_rate) : null,
      tip: Number(o.tip || 0),
      cardFee: Number(o.card_surcharge_amount || 0),
      cashDiscount: Number(o.cash_discount_amount || 0),
      total: Number(o.total || 0),
      refundAmount: refund,
      refunded: refund > 0,
      cashReceived: o.cash_received != null ? Number(o.cash_received) : null,
      changeGiven: o.change_given != null ? Number(o.change_given) : null,
      items: (o.items ?? []).map((i: { name: string; quantity: number; price: number }) => ({
        name: i.name, quantity: i.quantity, price: Number(i.price),
      })),
    }
  })

  // Totals over what was actually returned. Net of refunds, because the
  // question an owner is asking is "what did we take", and a gross figure
  // that ignores a refund answers a different one.
  const net = (s: typeof sales[number]) => s.total - s.refundAmount
  const cash = sales.filter((s) => s.paymentMethod === 'cash')
  const card = sales.filter((s) => s.paymentMethod !== 'cash')
  const sum = (xs: typeof sales) => Math.round(xs.reduce((t, s) => t + net(s), 0) * 100) / 100

  return NextResponse.json({
    from, to,
    count: sales.length,
    // True when the cap was hit — the totals below cover only what was
    // returned, so the UI must say so rather than present a partial day as
    // the whole day.
    truncated: sales.length >= limit,
    totals: {
      net: sum(sales),
      cash: sum(cash),
      card: sum(card),
      cashCount: cash.length,
      cardCount: card.length,
      tips: Math.round(sales.reduce((t, s) => t + s.tip, 0) * 100) / 100,
      // What the CUSTOMER paid on top — the convenience fee. Named so it
      // cannot be confused with the line below it, which is the opposite
      // direction of money.
      customerFees: Math.round(sales.reduce((t, s) => t + s.cardFee, 0) * 100) / 100,
      // What the PROCESSOR takes off the shop. Read from dd_pos_card_fees
      // rather than recomputed here: that ledger is what reconciles against
      // the deposit, and a second calculation of the same number is how the
      // two end up disagreeing.
      shopFees,
      refunds: Math.round(sales.reduce((t, s) => t + s.refundAmount, 0) * 100) / 100,
    },
    sales,
  })
}
