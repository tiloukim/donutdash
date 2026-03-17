'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

const FILTERS = ['all', 'pending', 'confirmed', 'preparing', 'ready_for_pickup']

// Play alert sound using Web Audio API
function playNewOrderSound() {
  try {
    const ctx = new AudioContext()
    const playBeep = (time: number, freq: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.value = 0.4
      osc.start(time)
      osc.stop(time + 0.2)
    }
    // Distinct rising tone pattern for new orders
    playBeep(ctx.currentTime, 660)
    playBeep(ctx.currentTime + 0.3, 880)
    playBeep(ctx.currentTime + 0.6, 1100)
    playBeep(ctx.currentTime + 0.9, 880)
    playBeep(ctx.currentTime + 1.2, 1100)
  } catch {
    // Audio not available
  }
}

export default function ShopOrders() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [updating, setUpdating] = useState<string | null>(null)
  const knownOrderIdsRef = useRef<Set<string>>(new Set())
  const isFirstLoadRef = useRef(true)

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const fetchOrders = useCallback(async () => {
    const url = filter === 'all' ? '/api/shop/orders' : `/api/shop/orders?status=${filter}`
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      // Check for new pending orders (not on first load)
      if (!isFirstLoadRef.current) {
        const newPendingOrders = data.filter(
          (o: any) => o.status === 'pending' && !knownOrderIdsRef.current.has(o.id)
        )
        if (newPendingOrders.length > 0) {
          playNewOrderSound()
          // Vibrate if supported (mobile)
          if (navigator.vibrate) {
            navigator.vibrate([300, 100, 300, 100, 300])
          }
          // Browser notification
          if ('Notification' in window && Notification.permission === 'granted') {
            newPendingOrders.forEach((o: any) => {
              new Notification('🍩 New Order!', {
                body: `Order #${o.id.slice(0, 8)} - $${o.total?.toFixed(2)} from ${o.customer?.name || 'Customer'}`,
                icon: '/logo.png',
                tag: `new-order-${o.id}`,
                requireInteraction: true,
              })
            })
          }
        }
      }
      isFirstLoadRef.current = false
      // Update known order IDs
      knownOrderIdsRef.current = new Set(data.map((o: any) => o.id))
      setOrders(data)
    }
    setLoading(false)
  }, [filter])

  useEffect(() => { fetchOrders() }, [fetchOrders])
  useEffect(() => { const i = setInterval(fetchOrders, 8000); return () => clearInterval(i) }, [fetchOrders])

  const updateStatus = async (orderId: string, status: string) => {
    setUpdating(orderId)
    await fetch(`/api/orders/${orderId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    await fetchOrders()
    setUpdating(null)
  }

  if (loading) return <div>Loading orders...</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
            background: filter === f ? '#FF1493' : '#FFF0F5', color: filter === f ? '#fff' : '#888', textTransform: 'capitalize',
          }}>
            {f === 'all' ? 'All' : f.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {orders.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: '#888', border: '1px solid #FFE4EF' }}>No orders found</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {orders.map((o: any) => (
            <div key={o.id} style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #FFE4EF' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <span style={{ fontWeight: 700, color: '#FF1493' }}>#{o.id.slice(0, 8)}</span>
                  <span style={{ marginLeft: 12, fontSize: 13, color: '#888' }}>{new Date(o.created_at).toLocaleString()}</span>
                </div>
                <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: o.status === 'pending' ? '#FEF3C7' : o.status === 'confirmed' ? '#DBEAFE' : o.status === 'preparing' ? '#E0E7FF' : '#D1FAE5', color: o.status === 'pending' ? '#92400E' : o.status === 'confirmed' ? '#1E40AF' : o.status === 'preparing' ? '#3730A3' : '#065F46' }}>
                  {o.status.replace(/_/g, ' ')}
                </span>
              </div>
              <div style={{ fontSize: 14, marginBottom: 8 }}>
                <strong>Customer:</strong> {o.customer?.name || 'N/A'} &bull; <strong>Address:</strong> {o.delivery_address}
              </div>
              <div style={{ fontSize: 13, color: '#555', marginBottom: 12 }}>
                {o.items?.map((item: any, i: number) => <span key={i}>{item.name} x{item.quantity}{i < o.items.length - 1 ? ', ' : ''}</span>)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: '#10B981', fontSize: 16 }}>${o.total.toFixed(2)}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {o.status === 'pending' && <>
                    <button onClick={() => updateStatus(o.id, 'confirmed')} disabled={updating === o.id} style={{ padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#10B981', color: '#fff', border: 'none', cursor: 'pointer' }}>Accept</button>
                    <button onClick={() => updateStatus(o.id, 'cancelled')} disabled={updating === o.id} style={{ padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#FEE2E2', color: '#DC2626', border: 'none', cursor: 'pointer' }}>Reject</button>
                  </>}
                  {o.status === 'confirmed' && <button onClick={() => updateStatus(o.id, 'preparing')} disabled={updating === o.id} style={{ padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#FF8C00', color: '#fff', border: 'none', cursor: 'pointer' }}>Start Preparing</button>}
                  {o.status === 'preparing' && <button onClick={() => updateStatus(o.id, 'ready_for_pickup')} disabled={updating === o.id} style={{ padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#6366F1', color: '#fff', border: 'none', cursor: 'pointer' }}>Ready for Pickup</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
