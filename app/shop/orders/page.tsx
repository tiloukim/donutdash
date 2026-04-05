'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useRealtime } from '@/lib/use-realtime'

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
    if (alertAudioRef.current?.dataset?.unlocked === 'true') return
    try {
      if (!alertAudioRef.current) { alertAudioRef.current = new Audio('/order-alert.wav'); alertAudioRef.current.loop = true }
      alertAudioRef.current.volume = 0.01
      await alertAudioRef.current.play()
      alertAudioRef.current.pause()
      alertAudioRef.current.currentTime = 0
      alertAudioRef.current.volume = 1.0
      alertAudioRef.current.dataset.unlocked = 'true'
      setSoundEnabled(true)
    } catch {
      // Browser blocked autoplay — will retry on next user interaction
    }
  }, [])

  // Try to unlock audio immediately on mount (page was reached via click)
  useEffect(() => {
    enableSound()
  }, [enableSound])

  // Also unlock on any user interaction as fallback
  useEffect(() => {
    if (soundEnabled) return
    const handler = () => enableSound()
    document.addEventListener('click', handler, { once: true })
    document.addEventListener('touchstart', handler, { once: true })
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

  // Realtime: instant new order alerts (supplements polling)
  useRealtime({
    table: 'dd_orders',
    event: '*',
    onData: () => fetchOrders(),
    enabled: true,
  })

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

                {/* Expanded Detail — DoorDash-style ticket */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid #FFE4EF', background: '#fff' }}>
                    {/* Ticket Header */}
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button onClick={(e) => { e.stopPropagation(); setExpandedId(null) }} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#666', padding: 0 }}>✕</button>
                        <span style={{ fontWeight: 800, fontSize: 18, color: '#1A1A2E' }}>{o.customer?.name || 'Customer'}</span>
                        <span style={{ color: '#888', fontSize: 14 }}>• #{o.id.slice(0, 5).toUpperCase()}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {o.customer?.phone && <a href={`tel:${o.customer.phone}`} style={{ fontSize: 20, textDecoration: 'none' }}>📞</a>}
                      </div>
                    </div>

                    {/* Two-column layout */}
                    <div style={{ display: 'flex', minHeight: 300 }}>
                      {/* LEFT — Items & totals */}
                      <div style={{ flex: 1, padding: '16px 20px', borderRight: '1px solid #f0f0f0' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#666', marginBottom: 12 }}>
                          {(o.items || []).reduce((s: number, i: any) => s + i.quantity, 0)} items
                          <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: statusStyle.bg, color: statusStyle.color, marginLeft: 8 }}>
                            {o.status === 'pending' ? 'NEW' : o.status.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        </div>

                        {/* Item list */}
                        <div style={{ marginBottom: 20 }}>
                          {(o.items || []).map((item: any, i: number) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f5f5f5' }}>
                              <div>
                                <span style={{ fontSize: 16, fontWeight: 500 }}>{item.quantity} × {item.name}</span>
                                {item.special_instructions && <div style={{ fontSize: 12, color: '#FF8C00', marginTop: 2 }}>⚠️ {item.special_instructions}</div>}
                              </div>
                              <span style={{ fontSize: 16, fontWeight: 500, color: '#1A1A2E' }}>${(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>

                        {/* Totals */}
                        <div style={{ borderTop: '2px solid #f0f0f0', paddingTop: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 14, color: '#666' }}>
                            <span>Subtotal</span><span>${o.subtotal?.toFixed(2)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 14, color: '#666' }}>
                            <span>Commission (15%)</span><span style={{ color: '#DC2626' }}>-${o.commission?.toFixed(2)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 18, fontWeight: 800, borderTop: '1px solid #f0f0f0', marginTop: 4 }}>
                            <span>Your Earnings</span><span style={{ color: '#10B981' }}>${o.shop_earnings?.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      {/* RIGHT — Driver, delivery, actions */}
                      <div style={{ width: 280, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {/* Driver info */}
                        {isTrackable && tracking && (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#FFE4EF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🚗</div>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 14 }}>{tracking.driver?.name || 'Driver'}</div>
                                <div style={{ fontSize: 12, color: '#FF1493', fontWeight: 600, textTransform: 'capitalize' }}>
                                  {tracking.delivery_status?.replace(/_/g, ' ') || 'Assigned'}
                                </div>
                              </div>
                            </div>
                            <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e5e7eb', height: 160 }}>
                              <DeliveryMap shopLat={shopLocation?.lat || 0} shopLng={shopLocation?.lng || 0} driverLat={tracking.location?.lat} driverLng={tracking.location?.lng} driverHeading={tracking.location?.heading} />
                            </div>
                          </div>
                        )}

                        {isTrackable && !tracking && (
                          <div style={{ padding: 16, textAlign: 'center', color: '#888', fontSize: 13, background: '#FFF0F5', borderRadius: 8 }}>
                            Waiting for driver...
                          </div>
                        )}

                        {/* Delivery address */}
                        <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>
                          <div style={{ fontWeight: 600, color: '#1A1A2E', marginBottom: 2 }}>Delivery</div>
                          {o.delivery_address}
                          {o.delivery_instructions && <div style={{ color: '#FF8C00', marginTop: 4 }}>📝 {o.delivery_instructions}</div>}
                        </div>

                        {/* Delivery Proof Photo */}
                        {o.status === 'delivered' && o.delivery_photo_url && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#10B981', marginBottom: 4 }}>DELIVERY PROOF</div>
                            <img src={o.delivery_photo_url} alt="Delivery proof" style={{ width: '100%', borderRadius: 8, border: '1px solid #e5e7eb' }} />
                          </div>
                        )}

                        {/* Scheduled time */}
                        {o.scheduled_for && (
                          <div style={{ background: '#FFF3E0', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#E65100', fontWeight: 600 }}>
                            ⏰ Scheduled: {new Date(o.scheduled_for).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </div>
                        )}

                        {/* Spacer */}
                        <div style={{ flex: 1 }} />

                        {/* Action buttons */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {o.status === 'pending' && <>
                            <button onClick={(e) => { e.stopPropagation(); updateStatus(o.id, 'confirmed') }} disabled={updating === o.id}
                              style={{ width: '100%', padding: '14px', borderRadius: 10, fontSize: 16, fontWeight: 800, background: '#10B981', color: '#fff', border: 'none', cursor: 'pointer' }}>
                              {updating === o.id ? '...' : '✓ Accept Order'}
                            </button>
                            {rejectingOrder === o.id ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <select value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                                  style={{ padding: '10px', borderRadius: 8, fontSize: 13, border: '1px solid #FCA5A5' }}>
                                  {REJECTION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button onClick={(e) => { e.stopPropagation(); updateStatus(o.id, 'cancelled', rejectReason) }} disabled={updating === o.id}
                                    style={{ flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#DC2626', color: '#fff', border: 'none', cursor: 'pointer' }}>
                                    Confirm Reject
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); setRejectingOrder(null) }}
                                    style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, background: '#F3F4F6', color: '#666', border: 'none', cursor: 'pointer' }}>
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={(e) => { e.stopPropagation(); setRejectingOrder(o.id); setRejectReason('Out of stock') }}
                                style={{ width: '100%', padding: '12px', borderRadius: 10, fontSize: 14, fontWeight: 700, background: '#FEE2E2', color: '#DC2626', border: '1px solid #FCA5A5', cursor: 'pointer' }}>
                                ✕ Reject
                              </button>
                            )}
                          </>}
                          {o.status === 'confirmed' && (
                            <button onClick={(e) => { e.stopPropagation(); updateStatus(o.id, 'preparing') }} disabled={updating === o.id}
                              style={{ width: '100%', padding: '14px', borderRadius: 10, fontSize: 16, fontWeight: 800, background: '#FF8C00', color: '#fff', border: 'none', cursor: 'pointer' }}>
                              {updating === o.id ? '...' : '🍩 Start Preparing'}
                            </button>
                          )}
                          {o.status === 'preparing' && (
                            <button onClick={(e) => { e.stopPropagation(); updateStatus(o.id, 'ready_for_pickup') }} disabled={updating === o.id}
                              style={{ width: '100%', padding: '14px', borderRadius: 10, fontSize: 16, fontWeight: 800, background: '#6366F1', color: '#fff', border: 'none', cursor: 'pointer' }}>
                              {updating === o.id ? '...' : '✓ Ready for Pickup'}
                            </button>
                          )}
                          {o.status === 'cancelled' && o.cancellation_reason && (
                            <div style={{ fontSize: 13, color: '#DC2626', fontStyle: 'italic', textAlign: 'center' }}>Rejected: {o.cancellation_reason}</div>
                          )}
                        </div>
                      </div>
                    </div>
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
