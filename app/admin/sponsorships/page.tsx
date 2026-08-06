'use client'

import { useEffect, useState } from 'react'

interface Order { id: string; shop_name: string; plan: string; amount: number; days: number; starts_at: string; ends_at: string; created_at: string }
interface ActiveSponsor { id: string; name: string; rank: number; expires_at: string | null }
interface Data {
  totals: { allTime: number; thisMonth: number; last30: number; orderCount: number; activeCount: number }
  activeSponsors: ActiveSponsor[]
  orders: Order[]
}

const ORANGE = '#FF8C00'
const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const day = (s: string | null) => s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
const daysLeft = (s: string | null) => s ? Math.max(0, Math.ceil((new Date(s).getTime() - Date.now()) / 86400000)) : null

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #eef0f2', borderRadius: 14, padding: '1.1rem 1.25rem' }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#9CA3AF' }}>{label}</div>
      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: accent ? ORANGE : '#111827', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

export default function AdminSponsorshipsPage() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/sponsorships')
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d) })
      .catch(() => setError('Could not load sponsorship data.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: '2rem', color: '#888' }}>Loading…</div>
  if (error) return <div style={{ padding: '2rem', color: '#DC2626' }}>{error}</div>
  if (!data) return null

  const t = data.totals

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem 1rem 4rem' }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#111827', margin: '0 0 4px' }}>⭐ Sponsorships</h1>
      <p style={{ color: '#6B7280', margin: '0 0 1.5rem', fontSize: '0.95rem' }}>Revenue from featured-shop placements (self-serve + admin-curated).</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: '1.5rem' }}>
        <Stat label="All-time revenue" value={money(t.allTime)} accent />
        <Stat label="This month" value={money(t.thisMonth)} />
        <Stat label="Last 30 days" value={money(t.last30)} />
        <Stat label="Active features" value={String(t.activeCount)} />
      </div>

      {/* Active sponsors */}
      <div style={{ background: '#fff', border: '1px solid #eef0f2', borderRadius: 14, padding: '1.25rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', margin: '0 0 0.75rem' }}>Featured right now ({data.activeSponsors.length})</h2>
        {data.activeSponsors.length === 0 ? (
          <div style={{ color: '#9CA3AF', fontSize: '0.9rem' }}>No shops are featured at the moment.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.activeSponsors.map(s => {
              const left = daysLeft(s.expires_at)
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderTop: '1px solid #f4f4f5' }}>
                  <div style={{ fontWeight: 600, color: '#111827' }}>{s.name}
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: ORANGE, background: '#FFF4E5', padding: '1px 7px', borderRadius: 12 }}>rank {s.rank}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#6B7280', textAlign: 'right' }}>
                    until {day(s.expires_at)}{left != null && <span style={{ color: left <= 3 ? '#DC2626' : '#9CA3AF' }}> · {left}d left</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Orders ledger */}
      <div style={{ background: '#fff', border: '1px solid #eef0f2', borderRadius: 14, padding: '1.25rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', margin: '0 0 0.75rem' }}>Purchases ({t.orderCount})</h2>
        {data.orders.length === 0 ? (
          <div style={{ color: '#9CA3AF', fontSize: '0.9rem' }}>No sponsorship purchases yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', minWidth: 520 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#9CA3AF', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '8px 10px' }}>Date</th>
                  <th style={{ padding: '8px 10px' }}>Shop</th>
                  <th style={{ padding: '8px 10px' }}>Plan</th>
                  <th style={{ padding: '8px 10px' }}>Feature window</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map(o => (
                  <tr key={o.id} style={{ borderTop: '1px solid #f4f4f5' }}>
                    <td style={{ padding: '9px 10px', color: '#6B7280', whiteSpace: 'nowrap' }}>{day(o.created_at)}</td>
                    <td style={{ padding: '9px 10px', fontWeight: 600, color: '#111827' }}>{o.shop_name}</td>
                    <td style={{ padding: '9px 10px', color: '#374151', textTransform: 'capitalize' }}>{o.plan}</td>
                    <td style={{ padding: '9px 10px', color: '#6B7280', whiteSpace: 'nowrap' }}>{day(o.starts_at)} – {day(o.ends_at)}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{money(o.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
