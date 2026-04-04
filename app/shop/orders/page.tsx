'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'

const DeliveryMap = dynamic(() => import('@/components/DeliveryMap'), { ssr: false })

const FILTERS = ['all', 'pending', 'confirmed', 'preparing', 'ready_for_pickup', 'delivered', 'cancelled']
const TRACKABLE_STATUSES = ['confirmed', 'preparing', 'ready_for_pickup']

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  pending: { bg: '#FEF3C7', color: '#92400E' },
  confirmed: { bg: '#DBEAFE', color: '#1E40AF' },
  preparing: { bg: '#E0E7FF', color: '#3730A3' },
  ready_for_pickup: { bg: '#D1FAE5', color: '#065F46' },
  picked_up: { bg: '#CFFAFE', color: '#155E75' },
  delivering: { bg: '#EDE9FE', color: '#5B21B6' },
  delivered: { bg: '#D1FAE5', color: '#065F46' },
  cancelled: { bg: '#FEE2E2', color: '#991B1B' },
}

interface TrackingData {
  delivery_status: string
  driver: { name: string }
  location: { lat: number; lng: number; heading?: number | null }
}

export default function ShopOrders() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [updating, setUpdating] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [rejectingOrder, setRejectingOrder] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('Out of stock')
  const knownOrderIdsRef = useRef<Set<string>>(new Set())
  const isFirstLoadRef = useRef(true)
  const alertAudioRef = useRef<HTMLAudioElement | null>(null)

  const [trackingData, setTrackingData] = useState<Record<string, TrackingData | null>>({})
  const [shopLocation, setShopLocation] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    fetch('/api/shop/settings').then(r => r.ok ? r.json() : null).then(data => {
      if (data?.lat && data?.lng) setShopLocation({ lat: data.lat, lng: data.lng })
    }).catch(() => {})
  }, [])

  // Poll tracking for expanded trackable orders
  useEffect(() => {
    if (!expandedId) return
    const order = orders.find(o => o.id === expandedId)
    if (!order || !TRACKABLE_STATUSES.includes(order.status)) return

    const fetchTracking = () => {
      fetch(`/api/driver/track/${expandedId}`).then(r => r.ok ? r.json() : null)
        .then(data => setTrackingData(prev => ({ ...prev, [expandedId]: data })))
        .catch(() => {})
    }
    fetchTracking()
    const interval = setInterval(fetchTracking, 5000)
    return () => clearInterval(interval)
  }, [expandedId, orders])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission()
  }, [])

  const enableSound = useCallback(async () => {
    if (soundEnabled) return
    try {
      if (!alertAudioRef.current) { alertAudioRef.current = new Audio('/order-alert.wav'); alertAudioRef.current.loop = true }
      alertAudioRef.current.volume = 0.01
      await alertAudioRef.current.play().catch(() => {})
      setTimeout(() => { if (alertAudioRef.current) { alertAudioRef.current.pause(); alertAudioRef.current.currentTime = 0; alertAudioRef.current.volume = 1.0 } }, 100)
      setSoundEnabled(true)
    } catch {}
  }, [soundEnabled])

  useEffect(() => {
    if (soundEnabled) return
    const handler = () => enableSound()
    document.addEventListener('click', handler)
    document.addEventListener('touchstart', handler)
    return () => { document.removeEventListener('click', handler); document.removeEventListener('touchstart', handler) }
  }, [soundEnabled, enableSound])

  const playAlert = () => {
    try {
      if (!alertAudioRef.current) { alertAudioRef.current = new Audio('/order-alert.wav'); alertAudioRef.current.loop = true }
      alertAudioRef.current.volume = 1.0; alertAudioRef.current.currentTime = 0; alertAudioRef.current.play().catch(() => {})
    } catch {}
  }
  const stopAlert = () => { if (alertAudioRef.current) { alertAudioRef.current.pause(); alertAudioRef.current.currentTime = 0 } }

  const fetchOrders = useCallback(async () => {
    const url = filter === 'all' ? '/api/shop/orders' : `/api/shop/orders?status=${filter}`
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      if (!isFirstLoadRef.current) {
        const newPending = data.filter((o: any) => o.status === 'pending' && !knownOrderIdsRef.current.has(o.id))
        if (newPending.length > 0) {
          playAlert()
          if (navigator.vibrate) navigator.vibrate([300, 100, 300])
          if ('Notification' in window && Notification.permission === 'granted') {
            newPending.forEach((o: any) => {
              new Notification('New Order!', { body: `Order #${o.id.slice(0, 8)} - $${o.subtotal?.toFixed(2)}`, icon: '/logo.png', tag: `order-${o.id}`, requireInteraction: true })
            })
          }
        }
      }
      isFirstLoadRef.current = false
      knownOrderIdsRef.current = new Set(data.map((o: any) => o.id))
      setOrders(data)
    }
    setLoading(false)
  }, [filter])

  useEffect(() => { fetchOrders() }, [fetchOrders])
  useEffect(() => { const i = setInterval(fetchOrders, 8000); return () => clearInterval(i) }, [fetchOrders])

  const REJECTION_REASONS = ['Out of stock', 'Shop closing soon', 'Too busy', 'Other']

  const updateStatus = async (orderId: string, status: string, cancellation_reason?: string) => {
    setUpdating(orderId); stopAlert()
    await fetch('/api/shop/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_id: orderId, status, ...(cancellation_reason ? { cancellation_reason } : {}) }) })
    setRejectingOrder(null)
    await fetchOrders()
    setUpdating(null)
  }

  const pendingCount = orders.filter(o => o.status === 'pending').length

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading orders...</div>

  return (
    <div>
      {/* Sound status */}
      <div style={{
        background: soundEnabled ? '#ECFDF5' : '#FFF7ED', border: `1px solid ${soundEnabled ? '#10B981' : '#FF8C00'}`,
        borderRadius: 10, padding: '8px 16px', marginBottom: 16, fontSize: 12, color: soundEnabled ? '#065F46' : '#9A3412', fontWeight: 600,
      }}>
        {soundEnabled ? '🔔 Sound alerts ON' : '🔕 Tap anywhere to enable sound alerts'}
      </div>

      {/* Pending banner */}
      {pendingCount > 0 && (
        <div style={{
          background: '#FFF0F5', border: '2px solid #FF1493', borderRadius: 12, padding: '12px 20px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 12, animation: 'pulse-border 1.5s ease-in-out infinite',
        }}>
          <span style={{ background: '#FF1493', color: '#fff', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15 }}>{pendingCount}</span>
          <span style={{ fontWeight: 700, color: '#FF1493', fontSize: 15 }}>
            {pendingCount === 1 ? 'New order waiting!' : `${pendingCount} new orders waiting!`}
          </span>
        </div>
      )}

      <style>{`
        @keyframes pulse-border { 0%,100% { box-shadow: 0 0 0 0 rgba(255,20,147,0.4); } 50% { box-shadow: 0 0 0 8px rgba(255,20,147,0); } }
        @keyframes pulse-bg { 0%,100% { background-color: #FFF0F5; } 50% { background-color: #FFE0ED; } }
      `}</style>

      {/* Filters */}
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
          {orders.map((o: any) => {
            const isExpanded = expandedId === o.id
            const statusStyle = STATUS_STYLES[o.status] || { bg: '#F3F4F6', color: '#374151' }
            const isTrackable = TRACKABLE_STATUSES.includes(o.status)
            const tracking = trackingData[o.id]
            const itemTotal = (o.items || []).reduce((s: number, i: any) => s + (i.price * i.quantity), 0)

            return (
              <div key={o.id} style={{
                background: o.status === 'pending' ? '#FFF8FB' : '#fff', borderRadius: 14,
                border: o.status === 'pending' ? '2px solid #FF1493' : '1px solid #FFE4EF',
                overflow: 'hidden',
                animation: o.status === 'pending' ? 'pulse-bg 2s ease-in-out infinite' : undefined,
              }}>
                {/* Order Header — clickable to expand */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : o.id)}
                  style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontWeight: 800, color: '#FF1493', fontSize: 15 }}>#{o.id.slice(0, 8)}</span>
                      <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: statusStyle.bg, color: statusStyle.color }}>
                        {o.status.replace(/_/g, ' ')}
                      </span>
                      {o.scheduled_for && (
                        <span style={{ fontSize: 11, color: '#FF8C00', fontWeight: 600 }}>
                          Scheduled: {new Date(o.scheduled_for).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: '#888' }}>
                      {o.customer?.name || 'Customer'} — {new Date(o.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                    </div>
                    <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>
                      {(o.items || []).length} item{(o.items || []).length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#10B981' }}>${o.shop_earnings?.toFixed(2)}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>Your earnings</div>
                    <span style={{ fontSize: 14, color: '#ccc' }}>{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid #FFE4EF', padding: '16px 20px', background: '#FFFAF5' }}>
                    {/* Items Table */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#FF1493', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Order Items</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #FFE4EF' }}>
                            <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: '#888', fontWeight: 600 }}>Item</th>
                            <th style={{ textAlign: 'center', padding: '6px 8px', fontSize: 11, color: '#888', fontWeight: 600 }}>Qty</th>
                            <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 11, color: '#888', fontWeight: 600 }}>Price</th>
                            <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 11, color: '#888', fontWeight: 600 }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(o.items || []).map((item: any, i: number) => (
                            <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                              <td style={{ padding: '8px', fontSize: 14 }}>
                                {item.name}
                                {item.special_instructions && <div style={{ fontSize: 11, color: '#FF8C00', marginTop: 2 }}>Note: {item.special_instructions}</div>}
                              </td>
                              <td style={{ padding: '8px', fontSize: 14, textAlign: 'center' }}>{item.quantity}</td>
                              <td style={{ padding: '8px', fontSize: 14, textAlign: 'right' }}>${Number(item.price).toFixed(2)}</td>
                              <td style={{ padding: '8px', fontSize: 14, textAlign: 'right', fontWeight: 600 }}>${(item.price * item.quantity).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Earnings Breakdown */}
                    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #FFE4EF', padding: 16, marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f5f5f5' }}>
                        <span style={{ fontSize: 13, color: '#666' }}>Subtotal</span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>${o.subtotal?.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f5f5f5' }}>
                        <span style={{ fontSize: 13, color: '#666' }}>Platform Commission (15%)</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#DC2626' }}>-${o.commission?.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', marginTop: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>Your Earnings</span>
                        <span style={{ fontSize: 16, fontWeight: 800, color: '#10B981' }}>${o.shop_earnings?.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Delivery Info */}
                    <div style={{ fontSize: 13, color: '#666', marginBottom: 16, lineHeight: 1.8 }}>
                      <div><strong>Delivery:</strong> {o.delivery_address}</div>
                      {o.delivery_instructions && <div><strong>Instructions:</strong> {o.delivery_instructions}</div>}
                      {o.customer?.phone && <div><strong>Customer Phone:</strong> {o.customer.phone}</div>}
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {o.status === 'pending' && <>
                        <button onClick={(e) => { e.stopPropagation(); updateStatus(o.id, 'confirmed') }} disabled={updating === o.id}
                          style={{ padding: '10px 28px', borderRadius: 10, fontSize: 15, fontWeight: 700, background: '#10B981', color: '#fff', border: 'none', cursor: 'pointer' }}>
                          {updating === o.id ? '...' : 'Accept Order'}
                        </button>
                        {rejectingOrder === o.id ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <select value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                              style={{ padding: '8px 10px', borderRadius: 8, fontSize: 13, border: '1px solid #FCA5A5' }}>
                              {REJECTION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <button onClick={(e) => { e.stopPropagation(); updateStatus(o.id, 'cancelled', rejectReason) }} disabled={updating === o.id}
                              style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#DC2626', color: '#fff', border: 'none', cursor: 'pointer' }}>
                              Confirm Reject
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setRejectingOrder(null) }}
                              style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, background: '#F3F4F6', color: '#666', border: 'none', cursor: 'pointer' }}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); setRejectingOrder(o.id); setRejectReason('Out of stock') }}
                            style={{ padding: '10px 28px', borderRadius: 10, fontSize: 15, fontWeight: 700, background: '#FEE2E2', color: '#DC2626', border: '1px solid #FCA5A5', cursor: 'pointer' }}>
                            Reject
                          </button>
                        )}
                      </>}
                      {o.status === 'confirmed' && (
                        <button onClick={(e) => { e.stopPropagation(); updateStatus(o.id, 'preparing') }} disabled={updating === o.id}
                          style={{ padding: '10px 28px', borderRadius: 10, fontSize: 15, fontWeight: 700, background: '#FF8C00', color: '#fff', border: 'none', cursor: 'pointer' }}>
                          {updating === o.id ? '...' : 'Start Preparing'}
                        </button>
                      )}
                      {o.status === 'preparing' && (
                        <button onClick={(e) => { e.stopPropagation(); updateStatus(o.id, 'ready_for_pickup') }} disabled={updating === o.id}
                          style={{ padding: '10px 28px', borderRadius: 10, fontSize: 15, fontWeight: 700, background: '#6366F1', color: '#fff', border: 'none', cursor: 'pointer' }}>
                          {updating === o.id ? '...' : 'Ready for Pickup'}
                        </button>
                      )}
                      {o.status === 'cancelled' && o.cancellation_reason && (
                        <span style={{ fontSize: 13, color: '#DC2626', fontStyle: 'italic' }}>Reason: {o.cancellation_reason}</span>
                      )}
                    </div>

                    {/* Driver Tracking */}
                    {isTrackable && shopLocation && (
                      <div style={{ marginTop: 16, borderTop: '1px solid #FFE4EF', paddingTop: 16 }}>
                        {!tracking ? (
                          <div style={{ padding: 16, textAlign: 'center', color: '#888', fontSize: 13, background: '#FFF0F5', borderRadius: 8 }}>
                            {tracking === null ? 'No driver assigned yet' : 'Loading tracking...'}
                          </div>
                        ) : (
                          <>
                            <div style={{ borderRadius: 10, overflow: 'hidden', border: '2px solid #FF1493', height: 250 }}>
                              <DeliveryMap shopLat={shopLocation.lat} shopLng={shopLocation.lng} driverLat={tracking.location?.lat} driverLng={tracking.location?.lng} driverHeading={tracking.location?.heading} />
                            </div>
                            <div style={{ marginTop: 8, padding: '8px 14px', background: '#FFF0F5', borderRadius: 8, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                              <div><strong style={{ color: '#FF1493' }}>Driver:</strong> {tracking.driver?.name || 'Unknown'}</div>
                              <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: '#FFE4EF', color: '#FF1493', textTransform: 'capitalize' }}>
                                {tracking.delivery_status?.replace(/_/g, ' ') || 'En route'}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
