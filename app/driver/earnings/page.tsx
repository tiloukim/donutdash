'use client'

import { useState, useEffect } from 'react'

export default function DriverEarnings() {
  const [data, setData] = useState<{ today: number; thisWeek: number; allTime: number; deliveries: any[] }>({ today: 0, thisWeek: 0, allTime: 0, deliveries: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/driver/earnings').then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) return <div>Loading earnings...</div>

  const cards = [
    { label: 'Today', value: data.today, color: '#10B981' },
    { label: 'This Week', value: data.thisWeek, color: '#FF8C00' },
    { label: 'All Time', value: data.allTime, color: '#6366F1' },
  ]

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 24 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #FFE8D6', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color }}>${c.value.toFixed(2)}</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{c.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #FFE8D6', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #FFE8D6' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Completed Deliveries</h3>
        </div>
        {data.deliveries.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>No completed deliveries yet</div>
        ) : (
          data.deliveries.map((d: any) => (
            <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid #f9f9f9' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{d.order?.shop?.name || 'Shop'}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{d.order?.delivery_address}</div>
                <div style={{ fontSize: 11, color: '#aaa' }}>{new Date(d.delivered_at || d.created_at).toLocaleDateString()}</div>
              </div>
              <span style={{ fontWeight: 700, color: '#10B981', fontSize: 16 }}>${(d.driver_earnings || 4.00).toFixed(2)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
