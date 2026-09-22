'use client'

import { useState, useEffect, useCallback } from 'react'

// Walk-in POS transactions, built for a phone first.
//
// The register's own "Today's Sales" screen was the only place these existed
// — /api/shop/orders filters to delivery + pickup, so an owner away from the
// shop could see that the day took $240 and not what any of it was.
//
// Read-only. Refund and reprint stay on the register: reprint needs the
// printer, and a refund from a phone with no drawer open and no customer
// present is a reconciliation problem rather than a feature.

type Sale = {
  id: string; shortCode: string | null; at: string; cashier: string | null
  paymentMethod: string | null; cardBrand: string | null; cardLast4: string | null
  authCode: string | null; refNumber: string | null
  subtotal: number; tax: number; taxRate: number | null; tip: number
  cardFee: number; cashDiscount: number; total: number
  refundAmount: number; refunded: boolean
  cashReceived: number | null; changeGiven: number | null
  items: { name: string; quantity: number; price: number }[]
}
type Totals = {
  net: number; cash: number; card: number; cashCount: number; cardCount: number
  tips: number; customerFees: number; shopFees: number; refunds: number
}

const money = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const localDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const shiftDay = (day: string, deltaDays: number) => {
  const [y, m, d] = day.split('-').map(Number)
  const dt = new Date(y, m - 1, d + deltaDays)
  return localDay(dt)
}
const prettyBrand = (b: string | null) =>
  !b ? null : b.charAt(0).toUpperCase() + b.slice(1).toLowerCase()

type SquareSale = {
  id: string; at: string; tender: string
  cardBrand: string | null; cardLast4: string | null
  total: number; tip: number; fee: number | null; refundAmount: number
}
type SquareTotals = {
  net: number; cash: number; card: number
  cashCount: number; cardCount: number
  tips: number; fees: number; refunds: number
}
type SquareState = {
  connected: boolean
  sales: SquareSale[]
  totals: SquareTotals | null
  error?: string
}

export default function ShopTransactions() {
  const [day, setDay] = useState(localDay())
  const [sales, setSales] = useState<Sale[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  // This shop's OWN Square, or nothing. There is no platform fallback: the
  // last version of this panel read DonutDash's account and showed every
  // shop the same online orders under a heading saying "your register".
  const [sq, setSq] = useState<SquareState | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // The server builds the day boundaries from this, so a sale rung at
      // 7am in Tyler lands on the right date rather than the previous one.
      const tz = new Date().getTimezoneOffset()
      const res = await fetch(`/api/shop/walkin-sales?from=${day}&to=${day}&tz_offset=${tz}`)
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || `Error ${res.status}`)
      setSales(d.sales || [])
      setTotals(d.totals || null)
      setTruncated(!!d.truncated)

      // Fetched separately and never allowed to fail the page: the two
      // registers are independent, and an outage at Square is no reason to
      // hide the shop's own takings.
      setSq(null)
      fetch(`/api/shop/square-sales?from=${day}&to=${day}&tz_offset=${tz}`)
        .then((r) => r.json())
        .then((sqd: SquareState) => setSq(sqd))
        .catch(() => setSq({ connected: true, sales: [], totals: null, error: 'Could not reach Square.' }))

    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load sales')
      setSales([])
      setTotals(null)
    } finally {
      setLoading(false)
    }
  }, [day])

  useEffect(() => { load() }, [load])

  // Card takings less what the processor keeps. Cash is deliberately not
  // here: it is already in the till, and folding it into a "deposit" would
  // produce a number that can never be reconciled against a bank statement.
  // Card takings less the convenience fee the processor keeps at
  // settlement. The per-card charge is NOT subtracted: it is billed to the
  // merchant account monthly, so deducting it here would understate every
  // day's deposit and never match a statement.
  const ddDeposit = totals
    ? Math.round((totals.card - (totals.customerFees ?? 0)) * 100) / 100
    : 0
  const sqDeposit = sq?.connected && sq.totals
    ? Math.round((sq.totals.card - sq.totals.fees) * 100) / 100
    : 0
  const cashInDrawer = Math.round(
    ((totals?.cash ?? 0) + (sq?.connected ? sq.totals?.cash ?? 0 : 0)) * 100,
  ) / 100

  const isToday = day === localDay()

  return (
    <div style={{ padding: '16px 14px 40px', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>Walk-in sales</h1>
      <p style={{ fontSize: 13, color: '#666', margin: '0 0 16px' }}>
        Every walk-in rung on the shop&apos;s register, by day.
      </p>

      {/* Day picker. Arrows because on a phone that is the gesture people
          actually use; the date field is there for jumping further back. */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <button onClick={() => setDay(shiftDay(day, -1))} style={navBtn} aria-label="Previous day">‹</button>
        <input
          type="date"
          value={day}
          max={localDay()}
          onChange={(e) => e.target.value && setDay(e.target.value)}
          style={{ ...input, flex: 1, minWidth: 0 }}
        />
        <button
          onClick={() => setDay(shiftDay(day, 1))}
          disabled={isToday}
          style={{ ...navBtn, opacity: isToday ? 0.35 : 1 }}
          aria-label="Next day"
        >›</button>
      </div>

      {!isToday && (
        <button onClick={() => setDay(localDay())} style={{ ...ghostBtn, marginBottom: 14 }}>
          Jump to today
        </button>
      )}

      {loading && <p style={{ color: '#666', fontSize: 14 }}>Loading…</p>}
      {error && (
        <div style={{ ...card, padding: 14, borderColor: '#F3C2C2', background: '#FFF6F6' }}>
          <p style={{ margin: 0, fontSize: 14, color: '#B42318' }}>{error}</p>
          <button onClick={load} style={{ ...ghostBtn, marginTop: 10 }}>Try again</button>
        </div>
      )}

      {!loading && !error && totals && (
        <div style={{ ...card, padding: 16, marginBottom: 14, background: '#FFF0F6', borderColor: '#FFC7E0' }}>
          <div style={{ fontSize: 12, color: '#9B1B5A', fontWeight: 700, letterSpacing: 0.4 }}>
            {sq?.connected && sq.totals ? 'BOTH REGISTERS' : 'WALK-IN TOTAL'}
          </div>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>
            {money(totals.net + (sq?.connected ? sq.totals?.net ?? 0 : 0))}
          </div>
          {sq?.connected && sq.totals && (
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              DonutDash {money(totals.net)} · Square {money(sq.totals.net)}
            </div>
          )}

          {/* What actually reaches the bank, which is not what was taken.
              Card money less the processor's cut; cash is excluded because
              it never goes through a processor at all — it is in the
              drawer, and a "deposit" figure that quietly included it would
              never match the statement. */}
          <div style={{ borderTop: '1px solid #FFC7E0', marginTop: 14, paddingTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, color: '#B4005A' }}>
              EXPECTED IN THE BANK
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, marginTop: 2 }}>
              {money(ddDeposit + sqDeposit)}
            </div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              DonutDash {money(ddDeposit)}
              {sq?.connected && sq.totals ? ` · Square ${money(sqDeposit)}` : ''}
              {cashInDrawer > 0 ? ` · ${money(cashInDrawer)} cash stays in the drawer` : ''}
            </div>
            {/* Square does not attach a processing fee until the payment
                settles, usually the next day. Today's deposit therefore
                reads high, and saying so beats having the statement
                disagree with the screen tomorrow. */}
            {sq?.connected && sq.totals && sq.totals.fees === 0 && sq.totals.cardCount > 0 && (
              <div style={{ fontSize: 11, color: '#8A6D3B', marginTop: 6 }}>
                Square hasn’t reported its fees for today yet — its deposit will be lower once they settle.
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && !error && totals && (
        <>
          <SectionHead title="DonutDash POS" count={sales.length} />
          {/* Net, not gross — a refunded sale should not read as money kept. */}
          <div style={{ ...card, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: '#666', fontWeight: 700, letterSpacing: 0.4 }}>NET TAKEN</div>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>{money(totals.net)}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginTop: 14 }}>
              <Stat label={`Cash · ${totals.cashCount}`} value={money(totals.cash)} />
              <Stat label={`Card · ${totals.cardCount}`} value={money(totals.card)} />
              {/* Always shown, not only when non-zero. Square's row shows
                  tips whatever they are, and two registers whose stats
                  appear and disappear independently cannot be read side by
                  side — a missing Tips on one reads as a layout difference,
                  not as "no tips today". */}
              <Stat label="Tips" value={money(totals.tips)} />
              {/* Two fees, opposite directions, and the old single "Card
                  fees" line was the customer-paid one wearing a name that
                  could mean either. */}
              {/* Three figures because there are three, and collapsing them
                  is what made the old single line misread.

                  Customer fees  the convenience fee, collected
                  Processor      what iPOSpays deducts: 3.5% + $0.15 a card
                  Net cost       the difference, which is the only one of
                                 the three that is the shop's own money

                  The flat $0.15 is never recovered by a percentage fee, and
                  the two 3.5%s are not the same 3.5%: the customer's is on
                  the subtotal, the processor's is on the settled total with
                  tax and the fee itself inside it. Net cost is where both
                  gaps show up. */}
              {/* Named for where each one goes. Customers paid the fee and
                  the processor kept it; the per-card charge is the shop's
                  and arrives on a monthly bill rather than out of a
                  deposit. */}
              {totals.cardCount > 0 && (
                <Stat label="Fee to processor" value={money(totals.customerFees ?? 0)} />
              )}
              {totals.cardCount > 0 && (
                <Stat label="Card fees (monthly)" value={`-${money(totals.shopFees ?? 0)}`} negative />
              )}
              {/* No net line.
                  The convenience fee and the shop's per-card charge are not
                  two sides of one number: the processor keeps the fee at
                  settlement and bills the per-card charge monthly. Setting
                  one against the other produced "Shop keeps $4.97", money
                  the shop never had. */}
              {totals.refunds > 0 && <Stat label="Refunded" value={`-${money(totals.refunds)}`} negative />}
            </div>
          </div>

          {truncated && (
            <p style={{ fontSize: 12, color: '#B54708', background: '#FFFAEB', border: '1px solid #FEDF89', borderRadius: 8, padding: '8px 10px', margin: '0 0 12px' }}>
              Showing the most recent {sales.length} sales for this day — the totals above cover only these.
            </p>
          )}

          {sales.length === 0 ? (
            <div style={{ ...card, padding: 24, textAlign: 'center' }}>
              <p style={{ margin: 0, color: '#666', fontSize: 14 }}>No walk-in sales on this day.</p>
            </div>
          ) : (
            <div style={{ ...card, overflow: 'hidden' }}>
              {sales.map((s, i) => (
                <SaleRow
                  key={s.id}
                  sale={s}
                  first={i === 0}
                  open={openId === s.id}
                  onToggle={() => setOpenId(openId === s.id ? null : s.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* This shop's OWN Square register.
          Rendered only when the shop has connected one — most shops have
          not, and an empty Square section on every shop's page is how the
          last version came to show DonutDash's online orders to merchants
          who had nothing to do with them. */}
      {!loading && !error && sq?.connected && (
        <div style={{ marginTop: 26 }}>
          <SectionHead title="Square POS" count={sq.sales.length} />

          {sq.error ? (
            <div style={{ ...card, padding: 14, borderColor: '#F3C2C2', background: '#FFF6F6' }}>
              <p style={{ margin: 0, fontSize: 14, color: '#B42318' }}>{sq.error}</p>
            </div>
          ) : sq.totals && (
            <>
              <div style={{ ...card, padding: 16, marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: '#666', fontWeight: 700, letterSpacing: 0.4 }}>NET TAKEN</div>
                <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>{money(sq.totals.net)}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginTop: 14 }}>
                  <Stat label={`Cash · ${sq.totals.cashCount}`} value={money(sq.totals.cash)} />
                  <Stat label={`Card · ${sq.totals.cardCount}`} value={money(sq.totals.card)} />
                  <Stat label="Tips" value={money(sq.totals.tips)} />
                  {/* Square's own cut, which is the same kind of number as
                      Shop fees on the register above — both are money the
                      processor keeps, so both are shown as a deduction. */}
                  <Stat label="Square fees" value={`-${money(sq.totals.fees)}`} negative />
                  {sq.totals.refunds > 0 && <Stat label="Refunded" value={`-${money(sq.totals.refunds)}`} negative />}
                </div>
              </div>

              {sq.sales.length === 0 ? (
                <div style={{ ...card, padding: 24, textAlign: 'center' }}>
                  <p style={{ margin: 0, color: '#666', fontSize: 14 }}>No Square sales on this day.</p>
                </div>
              ) : (
                <div style={{ ...card, overflow: 'hidden' }}>
                  {sq.sales.map((s, i) => (
                    <SquareRow key={s.id} sale={s} first={i === 0} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Square reports payments, not line items — a basket would need its Orders
 *  API and a second round trip per sale. Time, tender and amount is what a
 *  reconciliation needs anyway. */
function SquareRow({ sale, first }: { sale: SquareSale; first: boolean }) {
  const time = new Date(sale.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const brand = sale.cardBrand
    ? sale.cardBrand.charAt(0) + sale.cardBrand.slice(1).toLowerCase()
    : null
  const how = sale.tender === 'CASH'
    ? 'Cash'
    : brand && sale.cardLast4 ? `${brand} ${sale.cardLast4}` : 'Card'
  const refunded = sale.refundAmount > 0
  return (
    <div style={{ padding: '12px 14px', borderTop: first ? 'none' : '1px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{time}</div>
        <div style={{ fontSize: 12, color: '#666' }}>
          {how}
          {sale.tip > 0 && ` · ${money(sale.tip)} tip`}
          {refunded && ` · refunded ${money(sale.refundAmount)}`}
        </div>
      </div>
      <div style={{ fontWeight: 800, fontSize: 16, color: refunded ? '#B42318' : '#111' }}>
        {money(sale.total)}
      </div>
    </div>
  )
}

function Stat({ label, value, negative, positive }: {
  label: string; value: string; negative?: boolean; positive?: boolean
}) {
  // Three states, not two. Money out is red, money kept is green, and
  // everything else is just a number — a figure that can go either way
  // needs to say which way it went without the reader doing the sum.
  const color = negative ? '#B42318' : positive ? '#0F7B45' : '#111'
  return (
    <div>
      <div style={{ fontSize: 11, color: '#777', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color }}>{value}</div>
    </div>
  )
}

function SectionHead({ title, count }: { title: string; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '0 0 10px' }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>{title}</h2>
      <span style={{ fontSize: 12, color: '#777' }}>{count} sale{count === 1 ? '' : 's'}</span>
    </div>
  )
}



function SaleRow({ sale, first, open, onToggle }: { sale: Sale; first: boolean; open: boolean; onToggle: () => void }) {
  const time = new Date(sale.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const brand = prettyBrand(sale.cardBrand)
  const how = sale.paymentMethod === 'cash'
    ? 'Cash'
    : brand && sale.cardLast4 ? `${brand} ${sale.cardLast4}` : 'Card'

  return (
    <div style={{ borderTop: first ? 'none' : '1px solid #F0EAEF' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px',
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            {time}
            {sale.shortCode && <span style={{ color: '#999', fontWeight: 600 }}> · {sale.shortCode}</span>}
          </div>
          <div style={{ fontSize: 12.5, color: '#666', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {how}
            {sale.cashier && ` · ${sale.cashier}`}
            {sale.items.length > 0 && ` · ${sale.items.reduce((n, i) => n + i.quantity, 0)} item${sale.items.reduce((n, i) => n + i.quantity, 0) === 1 ? '' : 's'}`}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 16, fontWeight: 800,
            textDecoration: sale.refunded ? 'line-through' : 'none',
            color: sale.refunded ? '#999' : '#111',
          }}>{money(sale.total)}</div>
          {sale.refunded && (
            <div style={{ fontSize: 11, color: '#B42318', fontWeight: 700 }}>
              refunded {money(sale.refundAmount)}
            </div>
          )}
        </div>
        <span style={{ color: '#BBB', fontSize: 13 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 14px 14px', fontSize: 13.5 }}>
          <div style={{ background: '#FAFAFA', borderRadius: 8, padding: 12 }}>
            {sale.items.map((it, i) => (
              <Line key={i} label={it.quantity > 1 ? `${it.quantity} × ${it.name}` : it.name} value={money(it.price * it.quantity)} />
            ))}
            <div style={{ borderTop: '1px dashed #DDD', margin: '8px 0' }} />
            <Line label="Subtotal" value={money(sale.subtotal)} />
            {sale.cashDiscount > 0 && <Line label="Cash discount" value={`-${money(sale.cashDiscount)}`} />}
            <Line
              label={sale.taxRate ? `Tax (${(sale.taxRate * 100).toFixed(sale.taxRate * 100 % 1 === 0 ? 0 : 2)}%)` : 'Tax'}
              value={money(sale.tax)}
            />
            {sale.tip > 0 && <Line label="Tip" value={money(sale.tip)} />}
            {sale.cardFee > 0 && <Line label="Card fee" value={money(sale.cardFee)} />}
            <div style={{ borderTop: '1px dashed #DDD', margin: '8px 0' }} />
            <Line label="Total" value={money(sale.total)} bold />
            {sale.cashReceived != null && (
              <>
                <Line label="Cash tendered" value={money(sale.cashReceived)} />
                <Line label="Change" value={money(sale.changeGiven ?? 0)} />
              </>
            )}
            {(sale.authCode || sale.refNumber) && (
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed #DDD', fontSize: 11.5, color: '#777' }}>
                {sale.authCode && <div>Authorization: {sale.authCode}</div>}
                {/* The Ref # is what reconciles this row against the iPOSpays
                    Transactions log, which is the reason to show it at all. */}
                {sale.refNumber && <div>Ref #: {sale.refNumber}</div>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '2px 0', fontWeight: bold ? 800 : 400 }}>
      <span style={{ color: bold ? '#111' : '#555' }}>{label}</span>
      <span>{value}</span>
    </div>
  )
}

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #FFE4EF' }
const input: React.CSSProperties = { padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 16 }
const navBtn: React.CSSProperties = { padding: '10px 16px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer', lineHeight: 1 }
const ghostBtn: React.CSSProperties = { padding: '8px 14px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
