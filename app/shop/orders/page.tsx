'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useRealtime } from '@/lib/use-realtime'
import DriverAvatar from '@/components/DriverAvatar'

const DeliveryMap = dynamic(() => import('@/components/DeliveryMap'), { ssr: false })

const FILTERS = ['all', 'pending', 'adjusted', 'confirmed', 'preparing', 'ready_for_pickup', 'delivered', 'cancelled']
const TRACKABLE_STATUSES = ['confirmed', 'preparing', 'ready_for_pickup']

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  adjusted: { bg: '#FEF3C7', color: '#DC2626' },
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
  driver: { name: string; avatar_url?: string | null; selfie_url?: string | null }
  location: { lat: number; lng: number; heading?: number | null }
}

export default function ShopOrders() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [updating, setUpdating] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const [rejectingOrder, setRejectingOrder] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('Out of stock')
  const knownOrderIdsRef = useRef<Set<string>>(new Set())
  const isFirstLoadRef = useRef(true)
  // Alert sound handled by @/lib/alert-sound module

  const [trackingData, setTrackingData] = useState<Record<string, TrackingData | null>>({})
  const [shopLocation, setShopLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [paused, setPaused] = useState(false)
  const [pauseReason, setPauseReason] = useState('')
  const [pauseDuration, setPauseDuration] = useState('30')
  const [showPauseModal, setShowPauseModal] = useState(false)
  const [togglingPause, setTogglingPause] = useState(false)
  const [pauseEndsAt, setPauseEndsAt] = useState<string | null>(null)
  const [pauseTimeLeft, setPauseTimeLeft] = useState('')

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

  const playAlert = () => {
    if (muted) return
    import('@/lib/alert-sound').then(({ playUrgentAlert }) => playUrgentAlert('/order-alert.wav'))
  }
  const stopAlert = () => {
    import('@/lib/alert-sound').then(({ stopUrgentAlert }) => stopUrgentAlert())
  }

  const fetchOrders = useCallback(async () => {
    const url = filter === 'all' ? '/api/shop/orders' : `/api/shop/orders?status=${filter}`
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      const newPending = data.filter((o: any) => o.status === 'pending' && !knownOrderIdsRef.current.has(o.id))
      if (newPending.length > 0) {
        playAlert()
        if ('Notification' in window && Notification.permission === 'granted') {
          newPending.forEach((o: any) => {
            new Notification('New Order!', { body: `Order #${o.id.slice(0, 8)} - $${o.subtotal?.toFixed(2)}`, icon: '/logo.png', tag: `order-${o.id}`, requireInteraction: true })
          })
        }
      }
      knownOrderIdsRef.current = new Set(data.map((o: any) => o.id))
      setOrders(data)
    }
    setLoading(false)
  }, [filter])

  useEffect(() => { fetchOrders() }, [fetchOrders])
  // Load pause state
  useEffect(() => {
    fetch('/api/shop/pause').then(r => r.json()).then(d => {
      setPaused(d.paused || false)
      setPauseReason(d.pause_reason || '')
      setPauseEndsAt(d.pause_until || null)
    }).catch(() => {})
  }, [])
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

  const togglePause = async (newPaused: boolean, reason?: string, minutes?: number) => {
    setTogglingPause(true)
    const endsAt = newPaused && minutes ? new Date(Date.now() + minutes * 60000).toISOString() : null
    const res = await fetch('/api/shop/pause', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paused: newPaused, reason: reason || '', pause_until: endsAt }),
    })
    if (res.ok) {
      setPaused(newPaused)
      setPauseEndsAt(endsAt)
      if (!newPaused) { setPauseReason(''); setPauseEndsAt(null) }
    }
    setTogglingPause(false)
    setShowPauseModal(false)
  }

  // Countdown timer for pause
  useEffect(() => {
    if (!paused || !pauseEndsAt) { setPauseTimeLeft(''); return }
    const tick = () => {
      const left = new Date(pauseEndsAt).getTime() - Date.now()
      if (left <= 0) { togglePause(false); return }
      const mins = Math.floor(left / 60000)
      const secs = Math.floor((left % 60000) / 1000)
      setPauseTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`)
    }
    tick()
    const i = setInterval(tick, 1000)
    return () => clearInterval(i)
  }, [paused, pauseEndsAt])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading orders...</div>

  return (
    <div>
      {/* TOP BAR: Mute toggle + Pause button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={() => setMuted(m => !m)} style={{
          padding: '16px 32px', borderRadius: 12, fontSize: 22, fontWeight: 700, border: 'none', cursor: 'pointer',
          background: muted ? '#FEE2E2' : '#ECFDF5', color: muted ? '#DC2626' : '#065F46',
        }}>
          {muted ? '🔇 Sound OFF — Tap to unmute' : '🔔 Sound ON'}
        </button>
        {!paused && (
          <button onClick={() => setShowPauseModal(true)} style={{
            padding: '8px 16px', borderRadius: 8, background: '#FEE2E2', color: '#DC2626',
            fontWeight: 700, fontSize: 13, border: '1px solid #FECACA', cursor: 'pointer',
          }}>
            ⏸ Pause Orders
          </button>
        )}
      </div>

      {/* PAUSED BANNER */}
      {paused && (
        <div style={{
          background: '#DC2626', borderRadius: 12, padding: '16px 20px', marginBottom: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>⏸ ORDERS PAUSED</div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 }}>
              {pauseReason && <span>{pauseReason} · </span>}
              {pauseTimeLeft && <span>Resumes in {pauseTimeLeft}</span>}
              {!pauseTimeLeft && <span>Paused until manually resumed</span>}
            </div>
          </div>
          <button onClick={() => togglePause(false)} disabled={togglingPause} style={{
            padding: '10px 20px', borderRadius: 8, background: '#fff', color: '#DC2626',
            fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            {togglingPause ? '...' : '▶ Resume Now'}
          </button>
        </div>
      )}

      {/* Pause modal */}
      {showPauseModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setShowPauseModal(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 400, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#DC2626', marginBottom: 16 }}>⏸ Pause Orders</div>
            <p style={{ fontSize: 14, color: '#555', marginBottom: 16, lineHeight: 1.5 }}>
              New orders will be blocked. Existing orders are not affected.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#888', display: 'block', marginBottom: 6 }}>PAUSE FOR</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[{v:'30',l:'30 min'},{v:'60',l:'1 hour'},{v:'120',l:'2 hours'},{v:'0',l:'Until I resume'}].map(o => (
                  <button key={o.v} onClick={() => setPauseDuration(o.v)} style={{
                    padding: '10px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    background: pauseDuration === o.v ? '#DC2626' : '#f5f5f5',
                    color: pauseDuration === o.v ? '#fff' : '#555',
                    border: pauseDuration === o.v ? 'none' : '1px solid #ddd',
                  }}>{o.l}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#888', display: 'block', marginBottom: 6 }}>REASON (optional)</label>
              <select value={pauseReason} onChange={e => setPauseReason(e.target.value)} style={{
                width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box' as const,
              }}>
                <option value="">Select a reason...</option>
                <option value="Too busy">Too busy</option>
                <option value="Sold out">Sold out</option>
                <option value="Short staffed">Short staffed</option>
                <option value="Taking a break">Taking a break</option>
                <option value="Closing early">Closing early</option>
                <option value="Technical issues">Technical issues</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => togglePause(true, pauseReason, parseInt(pauseDuration) || 0)} disabled={togglingPause} style={{
                flex: 1, padding: '12px', borderRadius: 8, background: '#DC2626', color: '#fff',
                fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 14,
              }}>
                {togglingPause ? 'Pausing...' : 'Pause Orders'}
              </button>
              <button onClick={() => setShowPauseModal(false)} style={{
                padding: '12px 20px', borderRadius: 8, background: '#f5f5f5', color: '#555',
                fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: 14,
              }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
                      {o.fulfillment_type === 'pickup' && (
                        <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: '#FEF3C7', color: '#92400E' }}>
                          🏪 PICKUP
                        </span>
                      )}
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
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#1A1A2E' }}>${o.subtotal?.toFixed(2)}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{(o.items || []).reduce((s: number, i: any) => s + i.quantity, 0)} items</div>
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

                        {/* Total */}
                        <div style={{ borderTop: '2px solid #f0f0f0', paddingTop: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 18, fontWeight: 800 }}>
                            <span>Total</span><span>${o.subtotal?.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      {/* RIGHT — Driver, delivery, actions */}
                      <div style={{ width: 280, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {/* Driver info */}
                        {isTrackable && tracking && (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                              <DriverAvatar name={tracking.driver?.name} url={tracking.driver?.avatar_url} selfieUrl={tracking.driver?.selfie_url} size={40} />
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

                        {isTrackable && !tracking && o.fulfillment_type !== 'pickup' && (
                          <div style={{ padding: 16, textAlign: 'center', color: '#888', fontSize: 13, background: '#FFF0F5', borderRadius: 8 }}>
                            Waiting for driver...
                          </div>
                        )}

                        {/* Fulfillment info — pickup or delivery */}
                        {o.fulfillment_type === 'pickup' ? (
                          <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6, padding: '10px 12px', background: '#FFFBEB', borderRadius: 8, border: '1px solid #FDE68A' }}>
                            <div style={{ fontWeight: 700, color: '#92400E', marginBottom: 4 }}>🏪 Customer pickup</div>
                            <div>The customer will come to the shop to pick this up.</div>
                            {o.customer?.phone && <div style={{ marginTop: 4 }}>Phone: <a href={`tel:${o.customer.phone}`} style={{ color: '#FF1493', textDecoration: 'none' }}>{o.customer.phone}</a></div>}
                          </div>
                        ) : (
                          <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>
                            <div style={{ fontWeight: 600, color: '#1A1A2E', marginBottom: 2 }}>Delivery</div>
                            {o.delivery_address}
                            {o.delivery_instructions && <div style={{ color: '#FF8C00', marginTop: 4 }}>📝 {o.delivery_instructions}</div>}
                          </div>
                        )}

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
                          {(o.status === 'confirmed' || o.status === 'preparing' || o.status === 'ready_for_pickup') && (
                            rejectingOrder === o.id ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>
                                  Cancelling will refund the customer{o.status === 'ready_for_pickup' && o.fulfillment_type !== 'pickup' ? ' and release the assigned driver' : ''}.
                                </div>
                                <select value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                                  style={{ padding: '10px', borderRadius: 8, fontSize: 13, border: '1px solid #FCA5A5' }}>
                                  {REJECTION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button onClick={(e) => { e.stopPropagation(); updateStatus(o.id, 'cancelled', rejectReason) }} disabled={updating === o.id}
                                    style={{ flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#DC2626', color: '#fff', border: 'none', cursor: 'pointer' }}>
                                    {updating === o.id ? '...' : 'Confirm Cancel'}
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); setRejectingOrder(null) }}
                                    style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, background: '#F3F4F6', color: '#666', border: 'none', cursor: 'pointer' }}>
                                    Back
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
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
                                {o.status === 'ready_for_pickup' && o.fulfillment_type === 'pickup' && (
                                  <button onClick={(e) => { e.stopPropagation(); updateStatus(o.id, 'picked_up') }} disabled={updating === o.id}
                                    style={{ width: '100%', padding: '14px', borderRadius: 10, fontSize: 16, fontWeight: 800, background: '#10B981', color: '#fff', border: 'none', cursor: 'pointer' }}>
                                    {updating === o.id ? '...' : '✓ Mark as Picked Up'}
                                  </button>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); setRejectingOrder(o.id); setRejectReason('Out of stock') }}
                                  style={{ width: '100%', padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: '#FEE2E2', color: '#DC2626', border: '1px solid #FCA5A5', cursor: 'pointer' }}>
                                  ✕ Cancel Order
                                </button>
                              </>
                            )
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
