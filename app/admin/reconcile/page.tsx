'use client'

/**
 * Compare an iPOSpays settlement export against recorded sales.
 *
 * Charge intents catch a charge that approves and never becomes an order —
 * but only from the day that table existed. Anything lost before then has no
 * trace on our side, so the only way to find it is to ask the processor what
 * it settled and diff that against what we recorded.
 */

import { useRef, useState } from 'react'

interface Txn {
  ref: string; auth: string; cents: number | null
  last4: string; when: string; type: string; status: string
}
interface Result {
  csv_rows: number
  sales_considered: number
  matched: { how: string; count: number }[]
  unmatched_count: number
  unmatched_cents: number
  unmatched: Txn[]
  columns_used: Record<string, string | null>
}

const money = (c: number | null) => (c == null ? '—' : `$${(c / 100).toFixed(2)}`)

export default function Reconcile() {
  const [csv, setCsv] = useState('')
  const [res, setRes] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function run() {
    setBusy(true); setError(''); setRes(null)
    try {
      const r = await fetch('/api/admin/reconcile-ipospays', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error + (d.headers_seen ? ` — columns found: ${d.headers_seen.join(', ')}` : '')); return }
      setRes(d)
    } catch { setError('Could not run the comparison.') } finally { setBusy(false) }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>iPOSpays reconciliation</h1>
      <p style={{ fontSize: 13, color: '#6B7280', marginTop: 0, marginBottom: 18 }}>
        Export your transactions from the iPOSpays portal and drop the file here. Anything the
        processor settled that has no sale recorded against it will be listed below. Nothing is
        changed — this only reads.
      </p>

      <input
        ref={fileRef} type="file" accept=".csv,text/csv"
        onChange={(e) => {
          const f = e.target.files?.[0]; if (!f) return
          f.text().then((t) => { setCsv(t); setRes(null) })
        }}
        style={{ marginBottom: 10, fontSize: 13 }}
      />
      <textarea
        value={csv}
        onChange={(e) => { setCsv(e.target.value); setRes(null) }}
        placeholder="…or paste the CSV here, including its header row."
        style={{
          width: '100%', height: 130, padding: 12, borderRadius: 8, border: '1px solid #E5E7EB',
          fontSize: 12, fontFamily: 'ui-monospace, monospace', marginBottom: 12,
        }}
      />
      <button
        onClick={() => void run()} disabled={busy || !csv.trim()}
        style={{
          padding: '10px 22px', borderRadius: 8, fontSize: 14, fontWeight: 700, border: 'none',
          background: csv.trim() ? '#4F46E5' : '#C7D2FE', color: '#fff',
          cursor: csv.trim() ? 'pointer' : 'default',
        }}
      >
        {busy ? 'Comparing…' : 'Compare against recorded sales'}
      </button>

      {error && <p style={{ color: '#DC2626', fontSize: 13 }}>{error}</p>}

      {res && (
        <div style={{ marginTop: 22 }}>
          {/* Say which columns were used. An export with a renamed header can
              match on something weaker than intended, and a number nobody can
              interrogate is worse than no number. */}
          <p style={{ fontSize: 12, color: '#9CA3AF' }}>
            Read {res.csv_rows} rows, {res.sales_considered} of them sales. Columns used:{' '}
            {Object.entries(res.columns_used).filter(([, v]) => v).map(([k, v]) => `${k}=“${v}”`).join(', ') || 'none'}.
            Matched by {res.matched.filter((m) => m.count).map((m) => `${m.how} (${m.count})`).join(', ') || 'nothing'}.
          </p>

          {res.unmatched_count === 0 ? (
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: 20 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#166534' }}>Everything is accounted for</p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#15803D' }}>
                Every sale in this export has an order recorded against it.
              </p>
            </div>
          ) : (
            <>
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: 16, marginBottom: 14 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#B91C1C' }}>
                  {res.unmatched_count} settled {res.unmatched_count === 1 ? 'charge' : 'charges'} · {money(res.unmatched_cents)}
                </span>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#B91C1C' }}>
                  The processor settled these and DonutDash has no sale for them.
                </p>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                      {['When', 'Amount', 'Auth', 'Reference', 'Card', 'Type'].map((h) => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {res.unmatched.map((t, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{t.when || '—'}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(t.cents)}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{t.auth || '—'}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{t.ref || '—'}</td>
                        <td style={{ padding: '8px 10px' }}>{t.last4 ? `•••• ${t.last4}` : '—'}</td>
                        <td style={{ padding: '8px 10px', color: '#6B7280' }}>{t.type || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
