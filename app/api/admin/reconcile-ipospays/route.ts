import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Diff an iPOSpays settlement export against recorded sales.
 *
 * The charge-intent table catches a charge that approves and never becomes an
 * order — but only for charges made after it existed. Anything lost before
 * that leaves no trace on our side at all, so the only way to find it is to
 * ask the processor what it settled and compare. That is what this does.
 *
 * Nothing is written. It reads a CSV, reads orders, and reports the
 * difference; what to do about a missing sale is a decision for a person.
 */

async function requireAdmin() {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('role').eq('auth_id', user.id).single()
  if (!ddUser || ddUser.role !== 'admin') return { error: 'Forbidden', status: 403 as const }
  return { svc }
}

/**
 * CSV with quoted fields.
 *
 * Written out rather than split(',') because an export of card transactions
 * contains quoted commas — "DONUTS, ASSORTED" or a thousands separator in an
 * amount — and a naive split shifts every column after it, silently, for that
 * row only.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }   // escaped quote
        else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((f) => f.trim() !== '')) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some((f) => f.trim() !== '')) rows.push(row)
  return rows
}

/** Find a column by any of several header spellings. */
function col(headers: string[], ...names: string[]): number {
  const norm = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''))
  for (const n of names) {
    const want = n.toLowerCase().replace(/[^a-z0-9]/g, '')
    const i = norm.findIndex((h) => h === want)
    if (i >= 0) return i
  }
  // Looser: a header that CONTAINS the name. Exports rename columns between
  // versions and a reconciliation that fails on a renamed header is useless
  // at exactly the moment it is needed.
  for (const n of names) {
    const want = n.toLowerCase().replace(/[^a-z0-9]/g, '')
    const i = norm.findIndex((h) => h.includes(want))
    if (i >= 0) return i
  }
  return -1
}

const digits = (v: string) => (v ?? '').replace(/\D/g, '')
const money = (v: string) => {
  const n = Number((v ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? Math.round(Math.abs(n) * 100) : null
}

export async function POST(req: NextRequest) {
  const a = await requireAdmin()
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  const body = await req.json().catch(() => null)
  const csv = typeof body?.csv === 'string' ? body.csv : ''
  if (!csv.trim()) return NextResponse.json({ error: 'Paste the CSV export first.' }, { status: 400 })

  const rows = parseCsv(csv)
  if (rows.length < 2) return NextResponse.json({ error: 'That does not look like a CSV with a header row.' }, { status: 400 })

  const headers = rows[0]
  const iRef = col(headers, 'reference', 'rrn', 'retrievalreference', 'transactionid', 'pnref', 'refnumber')
  const iAuth = col(headers, 'authcode', 'approvalcode', 'authorizationcode', 'auth')
  const iAmount = col(headers, 'totalamount', 'amount', 'transactionamount', 'total')
  const iLast4 = col(headers, 'last4', 'cardnumber', 'cardlast4', 'account')
  const iDate = col(headers, 'date', 'datetime', 'transactiondate', 'createdat')
  const iType = col(headers, 'transactiontype', 'type', 'trantype')
  const iStatus = col(headers, 'status', 'result', 'responsetext')

  if (iRef < 0 && iAuth < 0 && iAmount < 0) {
    return NextResponse.json({
      error: 'Could not find a reference, auth code or amount column in that file.',
      headers_seen: headers,
    }, { status: 400 })
  }

  // Sales only. A refund or a void in the export is not a missing sale, and
  // reporting one as money we failed to record would send somebody hunting
  // for an order that should not exist.
  const txns = rows.slice(1).map((r) => ({
    ref: iRef >= 0 ? digits(r[iRef] ?? '') : '',
    auth: iAuth >= 0 ? (r[iAuth] ?? '').trim().toUpperCase() : '',
    cents: iAmount >= 0 ? money(r[iAmount] ?? '') : null,
    last4: iLast4 >= 0 ? digits(r[iLast4] ?? '').slice(-4) : '',
    when: iDate >= 0 ? (r[iDate] ?? '').trim() : '',
    type: iType >= 0 ? (r[iType] ?? '').trim() : '',
    status: iStatus >= 0 ? (r[iStatus] ?? '').trim() : '',
  })).filter((t) => {
    const ty = t.type.toLowerCase()
    if (ty && !/sale|purchase|charge/.test(ty)) return false
    const st = t.status.toLowerCase()
    if (st && /(declin|void|revers|fail|error)/.test(st)) return false
    return (t.cents ?? 0) > 0 || !!t.ref
  })

  // Every card sale we know about. Not date-filtered: the export's own date
  // format is unknown and parsing it wrongly would silently narrow the
  // comparison, which is the one failure mode that makes a reconciliation
  // report lie in the reassuring direction.
  const { data: orders, error } = await a.svc
    .from('dd_orders')
    .select('short_code, created_at, total, card_auth_code, card_ref_number, card_last4, payment_method')
    .like('payment_method', 'card%')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const byRef = new Map<string, typeof orders[number]>()
  const byAuth = new Map<string, typeof orders[number]>()
  const byAmountLast4 = new Map<string, typeof orders[number][]>()
  for (const o of orders ?? []) {
    const ref = digits(o.card_ref_number ?? '')
    if (ref) byRef.set(ref, o)
    const auth = (o.card_auth_code ?? '').trim().toUpperCase()
    if (auth) byAuth.set(auth, o)
    const key = `${Math.round(Number(o.total) * 100)}|${digits(o.card_last4 ?? '').slice(-4)}`
    const list = byAmountLast4.get(key) ?? []
    list.push(o)
    byAmountLast4.set(key, list)
  }

  const unmatched: typeof txns = []
  const matched: { how: string; count: number }[] = [
    { how: 'reference', count: 0 }, { how: 'auth code', count: 0 }, { how: 'amount + last 4', count: 0 },
  ]
  for (const t of txns) {
    if (t.ref && byRef.has(t.ref)) { matched[0].count++; continue }
    if (t.auth && byAuth.has(t.auth)) { matched[1].count++; continue }
    // Weakest match, and deliberately last: amount plus last four can
    // coincide between two genuine sales, so it is only ever used to say
    // "something plausible exists", never to claim a specific order.
    if (t.cents != null && t.last4 && (byAmountLast4.get(`${t.cents}|${t.last4}`)?.length ?? 0) > 0) {
      matched[2].count++; continue
    }
    unmatched.push(t)
  }

  return NextResponse.json({
    csv_rows: rows.length - 1,
    sales_considered: txns.length,
    matched,
    unmatched_count: unmatched.length,
    unmatched_cents: unmatched.reduce((s, t) => s + (t.cents ?? 0), 0),
    unmatched,
    columns_used: {
      reference: iRef >= 0 ? headers[iRef] : null,
      auth_code: iAuth >= 0 ? headers[iAuth] : null,
      amount: iAmount >= 0 ? headers[iAmount] : null,
      last4: iLast4 >= 0 ? headers[iLast4] : null,
      date: iDate >= 0 ? headers[iDate] : null,
    },
  })
}
