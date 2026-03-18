'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'

const DeliveryMap = dynamic(() => import('@/components/DeliveryMap'), { ssr: false })

const FILTERS = ['all', 'pending', 'confirmed', 'preparing', 'ready_for_pickup']
const TRACKABLE_STATUSES = ['confirmed', 'preparing', 'ready_for_pickup']

interface TrackingData {
  delivery_status: string
  driver: { name: string }
  location: { lat: number; lng: number }
}

export default function ShopOrders() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [updating, setUpdating] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const knownOrderIdsRef = useRef<Set<string>>(new Set())
  const isFirstLoadRef = useRef(true)
  const alertAudioRef = useRef<HTMLAudioElement | null>(null)

  // Tracking state
  const [expandedTracking, setExpandedTracking] = useState<Set<string>>(new Set())
  const [trackingData, setTrackingData] = useState<Record<string, TrackingData | null>>({})
  const [shopLocation, setShopLocation] = useState<{ lat: number; lng: number } | null>(null)

  // Fetch shop settings for lat/lng on mount
  useEffect(() => {
    const fetchShopSettings = async () => {
      try {
        const res = await fetch('/api/shop/settings')
        if (res.ok) {
          const data = await res.json()
          if (data.lat && data.lng) {
            setShopLocation({ lat: data.lat, lng: data.lng })
          }
        }
      } catch {
        // Shop settings not available
      }
    }
    fetchShopSettings()
  }, [])

  // Poll driver tracking for expanded orders
  useEffect(() => {
    if (expandedTracking.size === 0) return

    const fetchTracking = async () => {
      for (const orderId of expandedTracking) {
        try {
          const res = await fetch(`/api/driver/track/${orderId}`)
          if (res.ok) {
            const data = await res.json()
            setTrackingData(prev => ({ ...prev, [orderId]: data }))
          } else {
            setTrackingData(prev => ({ ...prev, [orderId]: null }))
          }
        } catch {
          setTrackingData(prev => ({ ...prev, [orderId]: null }))
        }
      }
    }

    fetchTracking()
    const interval = setInterval(fetchTracking, 5000)
    return () => clearInterval(interval)
  }, [expandedTracking])

  const toggleTracking = (orderId: string) => {
    setExpandedTracking(prev => {
      const next = new Set(prev)
      if (next.has(orderId)) {
        next.delete(orderId)
      } else {
        next.add(orderId)
      }
      return next
    })
  }

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Enable sound: pre-load audio file
  const enableSound = useCallback(async () => {
    if (soundEnabled) return
    try {
      if (!alertAudioRef.current) {
        alertAudioRef.current = new Audio('/order-alert.wav')
        alertAudioRef.current.loop = true
      }
      // Play silently to unlock on mobile
      alertAudioRef.current.volume = 0.01
      await alertAudioRef.current.play().catch(() => {})
      setTimeout(() => {
        if (alertAudioRef.current) {
          alertAudioRef.current.pause()
          alertAudioRef.current.currentTime = 0
          alertAudioRef.current.volume = 1.0
        }
      }, 100)
      setSoundEnabled(true)
      // Remember so we auto-unlock on next visit
      try { localStorage.setItem('dd_shop_sound', '1') } catch {}
    } catch {
      // Audio not available
    }
  }, [soundEnabled])

  // Auto-enable on ANY interaction (click, tap, scroll, keypress)
  // This makes it feel permanent — the first touch on the page unlocks audio
  useEffect(() => {
    if (soundEnabled) return
    const handler = () => enableSound()
    document.addEventListener('click', handler)
    document.addEventListener('touchstart', handler)
    document.addEventListener('keydown', handler, { once: true })
    document.addEventListener('scroll', handler, { once: true })
    return () => {
      document.removeEventListener('click', handler)
      document.removeEventListener('touchstart', handler)
      document.removeEventListener('keydown', handler)
      document.removeEventListener('scroll', handler)
    }
  }, [soundEnabled, enableSound])

  const playOrderAlert = () => {
    try {
      if (!alertAudioRef.current) {
        alertAudioRef.current = new Audio('/order-alert.wav')
        alertAudioRef.current.loop = true
      }
      alertAudioRef.current.volume = 1.0
      alertAudioRef.current.currentTime = 0
      alertAudioRef.current.play().catch(() => {})
    } catch {
      // Audio not available
    }
  }

  const stopAlert = () => {
    if (alertAudioRef.current) {
      alertAudioRef.current.pause()
      alertAudioRef.current.currentTime = 0
    }
  }

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
          playOrderAlert()
          // Vibrate if supported (mobile)
          if (navigator.vibrate) {
            navigator.vibrate([300, 100, 300, 100, 300])
          }
          // Browser notification
          if ('Notification' in window && Notification.permission === 'granted') {
            newPendingOrders.forEach((o: any) => {
              new Notification('New Order!', {
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
      knownOrderIdsRef.current = new Set(data.map((o: any) => o.id))
      setOrders(data)
    }
    setLoading(false)
  }, [filter])

  useEffect(() => { fetchOrders() }, [fetchOrders])
  useEffect(() => { const i = setInterval(fetchOrders, 8000); return () => clearInterval(i) }, [fetchOrders])

  const updateStatus = async (orderId: string, status: string) => {
    setUpdating(orderId)
    stopAlert() // Stop sound when shop acts on the order
    await fetch(`/api/orders/${orderId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    await fetchOrders()
    setUpdating(null)
  }

  if (loading) return <div>Loading orders...</div>

  return (
    <div>
      {/* Sound status */}
      <div style={{
        background: soundEnabled ? '#ECFDF5' : '#FFF7ED',
        border: `1px solid ${soundEnabled ? '#10B981' : '#FF8C00'}`,
        borderRadius: 10,
        padding: '8px 16px', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 12, color: soundEnabled ? '#065F46' : '#9A3412', fontWeight: 600,
      }}>
        {soundEnabled ? '🔔 Sound alerts ON — you will hear a ring when new orders arrive' : '🔕 Tap anywhere on this page to enable sound alerts'}
      </div>

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
            const isTrackable = TRACKABLE_STATUSES.includes(o.status)
            const isExpanded = expandedTracking.has(o.id)
            const tracking = trackingData[o.id]

            return (
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

                {/* Driver Tracking Section */}
                {isTrackable && (
                  <div style={{ marginTop: 12, borderTop: '1px solid #FFE4EF', paddingTop: 12 }}>
                    <button
                      onClick={() => toggleTracking(o.id)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        background: isExpanded ? '#FF1493' : '#FFF0F5',
                        color: isExpanded ? '#fff' : '#FF1493',
                        border: '1px solid #FF1493',
                        cursor: 'pointer',
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      {isExpanded ? 'Hide Driver Tracking' : 'Track Driver'}
                      <span style={{ fontSize: 10 }}>{isExpanded ? '▲' : '▼'}</span>
                    </button>

                    {isExpanded && (
                      <div style={{ marginTop: 12 }}>
                        {!shopLocation ? (
                          <div style={{
                            padding: 20,
                            textAlign: 'center',
                            color: '#888',
                            fontSize: 13,
                            background: '#FFF0F5',
                            borderRadius: 8,
                          }}>
                            Loading shop location...
                          </div>
                        ) : tracking === null ? (
                          <div style={{
                            padding: 20,
                            textAlign: 'center',
                            color: '#888',
                            fontSize: 13,
                            background: '#FFF0F5',
                            borderRadius: 8,
                          }}>
                            No driver assigned yet. Waiting for driver...
                          </div>
                        ) : tracking === undefined ? (
                          <div style={{
                            padding: 20,
                            textAlign: 'center',
                            color: '#888',
                            fontSize: 13,
                            background: '#FFF0F5',
                            borderRadius: 8,
                          }}>
                            Loading tracking data...
                          </div>
                        ) : (
                          <>
                            <div style={{
                              borderRadius: 10,
                              overflow: 'hidden',
                              border: '2px solid #FF1493',
                              height: 280,
                            }}>
                              <DeliveryMap
                                shopLat={shopLocation.lat}
                                shopLng={shopLocation.lng}
                                driverLat={tracking.location?.lat}
                                driverLng={tracking.location?.lng}
                              />
                            </div>
                            <div style={{
                              marginTop: 10,
                              padding: '10px 14px',
                              background: '#FFF0F5',
                              borderRadius: 8,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: 13,
                            }}>
                              <div>
                                <span style={{ fontWeight: 700, color: '#FF1493' }}>Driver: </span>
                                <span style={{ color: '#333' }}>{tracking.driver?.name || 'Unknown'}</span>
                              </div>
                              <span style={{
                                padding: '3px 10px',
                                borderRadius: 12,
                                fontSize: 11,
                                fontWeight: 700,
                                background: '#FFE4EF',
                                color: '#FF1493',
                                textTransform: 'capitalize',
                              }}>
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
