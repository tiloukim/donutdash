import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { buildHtml, type SalesReportBody, type ShopRow } from '@/lib/sales-report-email'

// Emails each subscribed shop's owner their day's sales at 5pm local.
//
// ── Why this fires twice a day ──────────────────────────────────────────
// Vercel crons are UTC and know nothing about daylight saving. 5pm in Tyler
// is 22:00 UTC in summer and 23:00 UTC in winter, so a fixed schedule would
// silently become a 4pm report every November. The schedule fires at BOTH
// hours and this route sends only when it is actually 17:00 where the shop
// is — so exactly one of the two invocations does anything, year round, and
// a shop in another timezone can be added without touching the schedule.
//
// ── Why the figures are recomputed here ────────────────────────────────
// The POS route of the same name renders numbers the register already
// worked out. Nothing is running at 5pm to hand them over, so this reads
// dd_orders directly. The RENDERING is shared (lib/sales-report-email) so
// the nightly email and the one an owner sends themselves from the register
// are the same document.

export const dynamic = 'force-dynamic'

/** Shops that get the email, and the timezone their 5pm is in.
 *
 *  An explicit list, like lib/tax-workspace: most shops on the platform are
 *  not ours, and starting to email other merchants' owners daily is not
 *  something to switch on by inference. Adding a shop is one line. */
const SUBSCRIBERS: { shopId: string; timeZone: string }[] = [
  // Top Donuts — Tyler, TX.
  { shopId: '22222222-2222-2222-2222-222222222222', timeZone: 'America/Chicago' },
]

/** Hour of the day, in the shop's own timezone, to send at. */
const SEND_HOUR = 17

/** Local Y-M-D and hour for a timezone, without pulling in a date library.
 *  'en-CA' because it formats as YYYY-MM-DD, which is what the queries want. */
function localParts(now: Date, timeZone: string): { day: string; hour: number } {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone, hour: '2-digit', hour12: false,
  }).format(now))
  return { day, hour }
}

/** Start/end instants of a local calendar day, as ISO strings.
 *
 *  Derived by measuring the zone's offset at that moment rather than
 *  assuming one: Tyler is UTC-5 half the year and UTC-6 the other half, and
 *  a hardcoded offset would file a morning's sales against the previous day
 *  for six months. */
function localDayRange(day: string, timeZone: string): { from: string; to: string } {
  const [y, m, d] = day.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d, 12, 0, 0)
  const asUtc = new Date(guess)
  const shown = new Date(
    new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).format(asUtc).replace(/(\d+)\/(\d+)\/(\d+),?\s/, '$3-$1-$2T') + 'Z',
  )
  const offsetMs = asUtc.getTime() - shown.getTime()
  const startLocalNoonUtc = Date.UTC(y, m - 1, d, 0, 0, 0) + offsetMs
  return {
    from: new Date(startLocalNoonUtc).toISOString(),
    to: new Date(startLocalNoonUtc + 24 * 60 * 60 * 1000 - 1).toISOString(),
  }
}

interface OrderRow {
  total: number | null
  subtotal: number | null
  tax: number | null
  tip: number | null
  refund_amount: number | null
  payment_method: string | null
  status: string | null
}

function isCard(method: string | null): boolean {
  return method != null && method !== 'cash'
}

/** Same shape the register's own report uses, so the two agree. */
function summarise(rows: OrderRow[]) {
  let gross = 0, refunds = 0, cash = 0, card = 0, tax = 0
  for (const o of rows) {
    const total = Number(o.total || 0)
    const refund = Number(o.refund_amount || 0)
    gross += total
    refunds += refund
    tax += Number(o.tax || 0)
    // Tender is net of refunds — the drawer and the deposit are both short by
    // what went back. Gross counts the sale because it happened.
    const net = total - refund
    if (isCard(o.payment_method)) card += net
    else cash += net
  }
  const count = rows.length
  const r2 = (n: number) => Math.round(n * 100) / 100
  return {
    gross: r2(gross),
    refunds: r2(refunds),
    net: r2(gross - refunds),
    tax: r2(tax),
    cashTotal: r2(cash),
    cardTotal: r2(card),
    count,
    averageSale: count > 0 ? r2((gross - refunds) / count) : 0,
  }
}

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })

  const svc = createServiceClient()
  const now = new Date()
  const results: Record<string, string> = {}

  for (const sub of SUBSCRIBERS) {
    const { day, hour } = localParts(now, sub.timeZone)
    if (hour !== SEND_HOUR) {
      results[sub.shopId] = `skipped — ${hour}:00 local, not ${SEND_HOUR}:00`
      continue
    }

    const { data: shop } = await svc
      .from('dd_shops')
      .select('id, name, address, city, state, zip, phone, owner_id')
      .eq('id', sub.shopId)
      .maybeSingle()
    if (!shop) { results[sub.shopId] = 'shop not found'; continue }

    const { data: owner } = await svc
      .from('dd_users')
      .select('email')
      .eq('id', (shop as { owner_id: string }).owner_id)
      .maybeSingle()
    const email = (owner as { email?: string } | null)?.email
    if (!email) { results[sub.shopId] = 'owner has no email on file'; continue }

    const { from, to } = localDayRange(day, sub.timeZone)
    const { data: orders } = await svc
      .from('dd_orders')
      .select('total, subtotal, tax, tip, refund_amount, payment_method, status')
      .eq('shop_id', sub.shopId)
      .eq('order_type', 'pos_walkin')
      .gte('created_at', from)
      .lte('created_at', to)

    const rows = (orders ?? []) as OrderRow[]
    if (rows.length === 0) {
      // No email on a day with no sales. A shop that was closed does not need
      // telling, and a run of zero-dollar reports is how a daily email stops
      // being read on the day it matters.
      results[sub.shopId] = 'skipped — no sales'
      continue
    }

    const s = summarise(rows)
    const body: SalesReportBody = {
      email,
      shopId: sub.shopId,
      periodLabel: new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
      }),
      // No percentages: there is no prior period fetched here, and a change
      // figure against nothing is the "+14486.9%" problem the register's
      // report screen just had to have suppressed.
      compareLabel: "Today's walk-in sales",
      gross: s.gross,
      net: s.net,
      refunds: s.refunds,
      count: s.count,
      averageSale: s.averageSale,
      cashTotal: s.cashTotal,
      cardTotal: s.cardTotal,
      grossChange: null,
      netChange: null,
      countChange: null,
      avgChange: null,
      cashChange: null,
      cardChange: null,
    }

    const envFrom = process.env.RESEND_FROM_EMAIL ?? 'DonutDash <notifications@donutdash.app>'
    const addressMatch = envFrom.match(/<([^>]+)>/)
    const fromAddress = addressMatch ? addressMatch[1] : envFrom.trim()
    const shopRow = shop as unknown as ShopRow
    const fromDisplayName = shopRow.name.replace(/[<>"\r\n]/g, '').trim() || 'DonutDash'

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${fromDisplayName} <${fromAddress}>`,
        to: email,
        subject: `Daily sales · ${shopRow.name} · ${body.periodLabel}`,
        html: buildHtml(body, shopRow),
      }),
    })
    results[sub.shopId] = res.ok
      ? `sent to ${email} — ${s.count} sales, $${s.gross.toFixed(2)}`
      : `send failed (${res.status})`
    if (!res.ok) console.error('[daily-sales-report] Resend', res.status, await res.text().catch(() => ''))
  }

  return NextResponse.json({ ok: true, at: now.toISOString(), results })
}
