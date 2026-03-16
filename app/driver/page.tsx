'use client'

import { useState, useEffect, useCallback } from 'react'

export default function DriverAvailable() {
  const [deliveries, setDeliveries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState<string | null>(null)

  const fetchDeliveries = useCallback(async () => {
    const res = await fetch('/api/driver/available')
    if (res.ok) setDeliveries(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchDeliveries() }, [fetchDeliveries])
  useEffect(() => { const i = setInterval(fetchDeliveries, 10000); return () => clearInterval(i) }, [fetchDeliveries])

  const accept = async (deliveryId: string) => {
    setAccepting(deliveryId)
    const res = await fetch('/api/driver/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ delivery_id: deliveryId }) })
    if (res.ok) {
      window.location.href = '/driver/active'
    } else {
      const err = await res.json()
      alert(err.error || 'Failed to accept')
      fetchDeliveries()
    }
    setAccepting(null)
  }

  if (loading) return <div>Loading available deliveries...</div>

  if (deliveries.length === 0) {
    return (
      <div style={{ background: '#fff', borderRadius: 12, padding: 60, textAlign: 'center', border: '1px solid #FFE8D6' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No Deliveries Available</h2>
        <p style={{ color: '#888' }}>Check back soon! New orders come in throughout the day.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {deliveries.map((d: any) => (
        <div key={d.id} style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #FFE8D6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#FF8C00' }}>{d.order?.shop?.name || 'Donut Shop'}</h3>
              <p style={{ fontSize: 13, color: '#888', marginTop: 2 }}>📍 {d.order?.shop?.address}, {d.order?.shop?.city}</p>
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#10B981' }}>${(d.driver_earnings || 4.00).toFixed(2)}</span>
          </div>
          <div style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>
            <strong>Deliver to:</strong> {d.order?.delivery_address}, {d.order?.delivery_city}
          </div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
            {d.order?.items?.map((item: any, i: number) => <span key={i}>{item.name} x{item.quantity}{i < d.order.items.length - 1 ? ', ' : ''}</span>)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#888' }}>Order total: ${d.order?.total?.toFixed(2)}</span>
            <button onClick={() => accept(d.id)} disabled={accepting === d.id} style={{
              padding: '8px 24px', borderRadius: 8, fontSize: 14, fontWeight: 700,
              background: accepting === d.id ? '#ccc' : '#FF8C00', color: '#fff', border: 'none', cursor: accepting === d.id ? 'not-allowed' : 'pointer',
            }}>
              {accepting === d.id ? 'Accepting...' : 'Accept Delivery'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
