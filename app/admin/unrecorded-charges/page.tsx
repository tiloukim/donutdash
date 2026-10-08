'use client'

/**
 * Card charges approved by the terminal that never became a sale.
 *
 * Empty is the correct state. Anything listed here is money a customer paid
 * that DonutDash has no sale for — it will appear in the processor's
 * settlement and in no report of ours.
 */

import { useEffect, useState } from 'react'

interface Row {
  id: string
  client_order_id: string
  shop_name: string
  cents: number
  auth_code: string | null
  ref_number: string | null
  card_last4: string | null
  terminal_at: string | null
  created_at: string
}

const money = (c: number) => `$${(c / 100).toFixed(2)}`

export default function UnrecordedCharges() {
  const [data, setData] = useState<{ days: number; count: number; total_cents: number; rows: Row[] } | null>(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true); setError('')
    fetch(`/api/admin/unrecorded-charges?days=${days}`)
      .then(r => r.json())
      .then(d => { d.error ? setError(d.error) : setData(d) })
      .catch(() => setError('Could not load.'))
      .finally(() => setLoading(false))
  }, [days])

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Unrecorded charges</h1>
      <p style={{ fontSize: 13, color: '#6B7280', marginTop: 0, marginBottom: 18 }}>
        Card charges the terminal approved that never became a sale. Each one is money taken
        with no order against it. This list should normally be empty.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[7, 30, 90].map(d => (
          <button
            key={d}
            onClick={() => setDays(d)}
            style={{
              padding: '6px 14px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: '1px solid ' + (days === d ? '#6366F1' : '#E5E7EB'),
              background: days === d ? '#EEF2FF' : '#fff',
              color: days === d ? '#4338CA' : '#6B7280',
            }}
          >
            Last {d} days
          </button>
        ))}
      </div>

      {loading && <p style={{ color: '#6B7280', fontSize: 14 }}>Loading…</p>}
      {error && <p style={{ color: '#DC2626', fontSize: 14 }}>{error}</p>}

      {data && !loading && (
        data.count === 0 ? (
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: 20 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#166534' }}>
              Nothing unrecorded
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#15803D' }}>
              Every approved card charge in the last {data.days} days has a sale recorded against it.
            </p>
          </div>
        ) : (
          <>
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: 16, marginBottom: 14 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#B91C1C' }}>
                {data.count} charge{data.count === 1 ? '' : 's'} · {money(data.total_cents)}
              </span>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#B91C1C' }}>
                Approved by the terminal, never recorded as a sale. Match these against the
                processor&rsquo;s settlement using the reference number.
              </p>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                    {['When', 'Shop', 'Amount', 'Auth', 'Reference', 'Card'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                        {new Date(r.terminal_at ?? r.created_at).toLocaleString('en-US', {
                          timeZone: 'America/Chicago', month: 'short', day: 'numeric',
                          hour: 'numeric', minute: '2-digit',
                        })}
                      </td>
                      <td style={{ padding: '8px 10px' }}>{r.shop_name}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(r.cents)}</td>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{r.auth_code ?? '—'}</td>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{r.ref_number ?? '—'}</td>
                      <td style={{ padding: '8px 10px' }}>{r.card_last4 ? `•••• ${r.card_last4}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      )}
    </div>
  )
}
