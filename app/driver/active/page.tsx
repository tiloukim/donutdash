'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const DeliveryMap = dynamic(() => import('@/components/DeliveryMap'), { ssr: false })

const STEPS = [
  { status: 'assigned', label: 'Assigned', icon: '📋' },
  { status: 'picked_up', label: 'Picked Up', icon: '🏪' },
  { status: 'delivering', label: 'Delivering', icon: '🚗' },
  { status: 'delivered', label: 'Delivered', icon: '✅' },
]

export default function ActiveDelivery() {
  const [delivery, setDelivery] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number; heading: number | null } | null>(null)

  const fetchActive = useCallback(async () => {
    const res = await fetch('/api/driver/active')
    if (res.ok) {
      const data = await res.json()
      setDelivery(data)
    } else {
      setDelivery(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchActive() }, [fetchActive])

  // Keep screen awake during active delivery (prevents GPS from stopping)
  useEffect(() => {
    if (!delivery) return
    let wakeLock: any = null

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen')
        }
      } catch {
        // Wake lock not supported or failed
      }
    }

    requestWakeLock()

    // Re-acquire wake lock when page becomes visible again
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      if (wakeLock) wakeLock.release().catch(() => {})
    }
  }, [delivery])

  // Heartbeat: keep driver online while on active delivery page
  useEffect(() => {
    if (!delivery) return
    const heartbeat = setInterval(() => {
      fetch('/api/driver/online', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ online: true }),
      }).catch(() => {})
    }, 30000)
    // Send immediately on mount
    fetch('/api/driver/online', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ online: true }),
    }).catch(() => {})
    return () => clearInterval(heartbeat)
  }, [delivery])

  // Track driver location while active
  useEffect(() => {
    if (!delivery) return
    if (!navigator.geolocation) return

    let lastSentAt = 0

    let prevLat = 0, prevLng = 0

    const handlePosition = (pos: GeolocationPosition) => {
      // Calculate heading from movement if device doesn't provide it
      let heading = pos.coords.heading
      if (heading == null && prevLat && prevLng) {
        const dLat = pos.coords.latitude - prevLat
        const dLng = pos.coords.longitude - prevLng
        if (Math.abs(dLat) > 0.00001 || Math.abs(dLng) > 0.00001) {
          heading = (Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360
        }
      }
      prevLat = pos.coords.latitude
      prevLng = pos.coords.longitude

      setDriverPos({ lat: pos.coords.latitude, lng: pos.coords.longitude, heading: heading ?? null })

      // Throttle server updates to every 5 seconds
      const now = Date.now()
      if (now - lastSentAt < 5000) return
      lastSentAt = now

      fetch('/api/driver/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
        }),
      }).catch(() => {})
    }

    const watchId = navigator.geolocation.watchPosition(
      handlePosition,
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    )

    // Backup polling every 8 seconds (watchPosition can stall on mobile)
    const gpsInterval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        handlePosition,
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 }
      )
    }, 8000)

    return () => {
      navigator.geolocation.clearWatch(watchId)
      clearInterval(gpsInterval)
    }
  }, [delivery])

  const updateStatus = async (newStatus: string) => {
    if (!delivery) return
    setUpdating(true)
    await fetch('/api/driver/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delivery_id: delivery.id, status: newStatus }),
    })
    if (newStatus === 'delivered') {
      setCompleted(true)
    } else {
      await fetchActive()
    }
    setUpdating(false)
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>

  if (completed) {
    return (
      <div style={{ background: '#fff', borderRadius: 16, padding: 60, textAlign: 'center', border: '1px solid #D1FAE5' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: '#065F46', marginBottom: 8 }}>Delivery Complete!</h2>
        <p style={{ fontSize: 16, color: '#10B981', fontWeight: 700, marginBottom: 24 }}>
          Earned: ${(delivery?.driver_earnings || 4.00).toFixed(2)}
        </p>
        <Link href="/driver" style={{
          background: '#FF8C00', color: '#fff', padding: '12px 28px',
          borderRadius: 8, textDecoration: 'none', fontWeight: 700,
        }}>
          Find More Deliveries
        </Link>
      </div>
    )
  }

  if (!delivery) {
    return (
      <div style={{ background: '#fff', borderRadius: 16, padding: 60, textAlign: 'center', border: '1px solid #FFE8D6' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚗</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No Active Delivery</h2>
        <p style={{ color: '#888', marginBottom: 24 }}>You don&apos;t have an active delivery right now.</p>
        <Link href="/driver" style={{
          background: '#FF8C00', color: '#fff', padding: '12px 28px',
          borderRadius: 8, textDecoration: 'none', fontWeight: 700,
        }}>
          View Available Deliveries
        </Link>
      </div>
    )
  }

  const currentIdx = STEPS.findIndex(s => s.status === delivery.status)
  const shopLat = delivery.order?.shop?.lat || delivery.pickup_lat
  const shopLng = delivery.order?.shop?.lng || delivery.pickup_lng
  const custLat = delivery.dropoff_lat || delivery.order?.delivery_lat
  const custLng = delivery.dropoff_lng || delivery.order?.delivery_lng

  return (
    <div>
      {/* Map */}
      {(shopLat && shopLng) && (
        <div style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 16, height: 300, border: '1px solid #FFE8D6' }}>
          <DeliveryMap
            shopLat={shopLat}
            shopLng={shopLng}
            customerLat={custLat}
            customerLng={custLng}
            driverLat={driverPos?.lat}
            driverLng={driverPos?.lng}
            driverHeading={driverPos?.heading}
            followDriver
          />
        </div>
      )}

      {/* Progress Bar */}
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #FFE8D6', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          {STEPS.map((step, i) => (
            <div key={step.status} style={{ textAlign: 'center', flex: 1 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px', fontSize: 18,
                background: i <= currentIdx ? '#FF8C00' : '#f5f5f5',
                color: i <= currentIdx ? '#fff' : '#888',
              }}>{step.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: i <= currentIdx ? '#FF8C00' : '#888' }}>
                {step.label}
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center' }}>
          {delivery.status === 'assigned' && (
            <button onClick={() => updateStatus('picked_up')} disabled={updating} style={{
              padding: '12px 32px', borderRadius: 8, fontSize: 15, fontWeight: 700,
              background: '#FF8C00', color: '#fff', border: 'none', cursor: 'pointer',
            }}>
              {updating ? 'Updating...' : 'Picked Up Order'}
            </button>
          )}
          {delivery.status === 'picked_up' && (
            <button onClick={() => updateStatus('delivering')} disabled={updating} style={{
              padding: '12px 32px', borderRadius: 8, fontSize: 15, fontWeight: 700,
              background: '#FF8C00', color: '#fff', border: 'none', cursor: 'pointer',
            }}>
              {updating ? 'Updating...' : 'Heading to Customer'}
            </button>
          )}
          {delivery.status === 'delivering' && (
            <button onClick={() => updateStatus('delivered')} disabled={updating} style={{
              padding: '12px 32px', borderRadius: 8, fontSize: 15, fontWeight: 700,
              background: '#10B981', color: '#fff', border: 'none', cursor: 'pointer',
            }}>
              {updating ? 'Updating...' : 'Mark Delivered'}
            </button>
          )}
        </div>
      </div>

      {/* Order Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #FFE8D6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#888', marginBottom: 12 }}>PICKUP</h3>
              <p style={{ fontWeight: 700, fontSize: 16 }}>{delivery.order?.shop?.name}</p>
              <p style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                {delivery.order?.shop?.address}, {delivery.order?.shop?.city}
              </p>
            </div>
            {(delivery.status === 'assigned') && (
              <button
                onClick={() => {
                  const addr = encodeURIComponent(`${delivery.order?.shop?.address}, ${delivery.order?.shop?.city}, ${delivery.order?.shop?.state}`)
                  const lat = shopLat
                  const lng = shopLng
                  // Try Google Maps first, falls back to Apple Maps on iOS
                  const url = lat && lng
                    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
                    : `https://www.google.com/maps/dir/?api=1&destination=${addr}`
                  window.open(url, '_blank')
                }}
                style={{
                  padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  background: '#3B82F6', color: '#fff', border: 'none', cursor: 'pointer',
                  whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                🧭 Navigate
              </button>
            )}
          </div>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #FFE8D6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#888', marginBottom: 12 }}>DELIVER TO</h3>
              <p style={{ fontWeight: 700, fontSize: 16 }}>{delivery.order?.customer?.name || 'Customer'}</p>
              <p style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                {delivery.order?.delivery_address}, {delivery.order?.delivery_city}
              </p>
              {delivery.order?.delivery_instructions && (
                <p style={{ fontSize: 12, color: '#FF8C00', marginTop: 6 }}>
                  Note: {delivery.order.delivery_instructions}
                </p>
              )}
            </div>
            {(delivery.status === 'picked_up' || delivery.status === 'delivering') && (
              <button
                onClick={() => {
                  const addr = encodeURIComponent(`${delivery.order?.delivery_address}, ${delivery.order?.delivery_city}`)
                  const lat = custLat
                  const lng = custLng
                  const url = lat && lng
                    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
                    : `https://www.google.com/maps/dir/?api=1&destination=${addr}`
                  window.open(url, '_blank')
                }}
                style={{
                  padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  background: '#10B981', color: '#fff', border: 'none', cursor: 'pointer',
                  whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                🧭 Navigate
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Items */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #FFE8D6', marginTop: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#888', marginBottom: 12 }}>ORDER ITEMS</h3>
        {delivery.order?.items?.map((item: any) => (
          <div key={item.id} style={{
            display: 'flex', justifyContent: 'space-between', padding: '6px 0',
            borderBottom: '1px solid #f5f5f5',
          }}>
            <span>{item.name} x{item.quantity}</span>
            <span style={{ fontWeight: 600 }}>${(item.price * item.quantity).toFixed(2)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', fontWeight: 700, fontSize: 16 }}>
          <span>Your Earnings</span>
          <span style={{ color: '#10B981' }}>${(delivery.driver_earnings || 4.00).toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}
