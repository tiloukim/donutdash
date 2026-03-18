'use client'

import { useState, useEffect } from 'react'

export default function DriverEarnings() {
  const [data, setData] = useState<{ today: number; thisWeek: number; allTime: number; deliveries: any[] }>({ today: 0, thisWeek: 0, allTime: 0, deliveries: [] })
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/driver/earnings').then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 60 }}>
      <div style={{ color: '#FF8C00', fontWeight: 600 }}>Loading earnings...</div>
    </div>
  )

  const cards = [
    { label: 'Today', value: data.today, color: '#10B981' },
    { label: 'This Week', value: data.thisWeek, color: '#FF8C00' },
    { label: 'All Time', value: data.allTime, color: '#6366F1' },
    { label: 'Total Deliveries', value: data.deliveries.length, color: '#FF8C00', isCount: true },
  ]

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id)
  }

  const getBreakdown = (d: any) => {
    const basePay = d.base_pay ?? 3.00
    const tip = d.order?.tip ?? 0
    const total = d.driver_earnings ?? 4.00
    const distanceBonus = Math.max(0, total - basePay - tip)
    return { basePay, tip, distanceBonus, total }
  }

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #FFE8D6', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color }}>
              {(c as any).isCount ? c.value : `$${(c.value as number).toFixed(2)}`}
            </div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{c.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #FFE8D6', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #FFE8D6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Completed Deliveries</h3>
          <span style={{ fontSize: 13, color: '#888' }}>{data.deliveries.length} total</span>
        </div>
        {data.deliveries.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>No completed deliveries yet</div>
        ) : (
          data.deliveries.map((d: any) => {
            const isExpanded = expandedId === d.id
            const breakdown = getBreakdown(d)
            const dt = formatDateTime(d.delivered_at || d.created_at)

            return (
              <div key={d.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <div
                  onClick={() => toggleExpand(d.id)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 20px',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    background: isExpanded ? '#FFF8F0' : '#fff',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 15 }}>{d.order?.shop?.name || 'Shop'}</span>
                      {d.distance_miles != null && (
                        <span style={{ fontSize: 11, color: '#FF8C00', background: '#FFF3E6', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                          {d.distance_miles.toFixed(1)} mi
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 3 }}>{d.order?.delivery_address || 'N/A'}</div>
                    <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{dt.date} at {dt.time}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 700, color: '#10B981', fontSize: 17 }}>${breakdown.total.toFixed(2)}</span>
                    <span style={{
                      display: 'inline-block',
                      width: 0,
                      height: 0,
                      borderLeft: '5px solid transparent',
                      borderRight: '5px solid transparent',
                      borderTop: isExpanded ? 'none' : '6px solid #ccc',
                      borderBottom: isExpanded ? '6px solid #FF8C00' : 'none',
                      transition: 'transform 0.2s',
                    }} />
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: '0 20px 16px 20px', background: '#FFF8F0' }}>
                    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #FFE8D6', overflow: 'hidden' }}>
                      <div style={{ padding: '10px 16px', borderBottom: '1px solid #f5f5f5', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, color: '#666' }}>Base Pay</span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>${breakdown.basePay.toFixed(2)}</span>
                      </div>
                      <div style={{ padding: '10px 16px', borderBottom: '1px solid #f5f5f5', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, color: '#666' }}>Distance Bonus</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: breakdown.distanceBonus > 0 ? '#FF8C00' : '#888' }}>
                          {breakdown.distanceBonus > 0 ? '+' : ''}${breakdown.distanceBonus.toFixed(2)}
                        </span>
                      </div>
                      <div style={{ padding: '10px 16px', borderBottom: '1px solid #f5f5f5', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, color: '#666' }}>Tip</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: breakdown.tip > 0 ? '#10B981' : '#888' }}>
                          {breakdown.tip > 0 ? '+' : ''}${breakdown.tip.toFixed(2)}
                        </span>
                      </div>
                      <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', background: '#FAFAFA' }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>Total Earned</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#10B981' }}>${breakdown.total.toFixed(2)}</span>
                      </div>
                    </div>
                    {d.distance_miles != null && (
                      <div style={{ marginTop: 8, fontSize: 12, color: '#888', textAlign: 'right' }}>
                        Distance: {d.distance_miles.toFixed(1)} miles
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
