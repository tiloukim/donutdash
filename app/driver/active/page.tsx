'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import ChatBox from '@/components/ChatBox'

const DeliveryMap = dynamic(() => import('@/components/DeliveryMap'), { ssr: false })

const STEPS = [
  { status: 'assigned', label: 'Assigned', icon: '📋' },
  { status: 'picked_up', label: 'Picked Up', icon: '🏪' },
  { status: 'delivering', label: 'Delivering', icon: '🚗' },
  { status: 'delivered', label: 'Delivered', icon: '✅' },
]

export default function ActiveDelivery() {
  const [deliveries, setDeliveries] = useState<any[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number; heading: number | null } | null>(null)
  const [deliveryPhoto, setDeliveryPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string>('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  // Proof-of-pickup photo (of the order at the shop), required before Picked Up.
  const [pickupPhotoUrl, setPickupPhotoUrl] = useState<string>('')
  const [uploadingPickup, setUploadingPickup] = useState(false)
  const pickupInputRef = useRef<HTMLInputElement>(null)

  const delivery = deliveries[activeIdx] || null

  const fetchActive = useCallback(async () => {
    const res = await fetch('/api/driver/active')
    if (res.ok) {
      const data = await res.json()
      if (data?.deliveries) {
        setDeliveries(data.deliveries)
        // Keep activeIdx in bounds
        setActiveIdx(prev => Math.min(prev, data.deliveries.length - 1))
      } else if (data && !data.deliveries) {
        // Backwards compat: single delivery response
        setDeliveries(data ? [data] : [])
      } else {
        setDeliveries([])
      }
    } else {
      setDeliveries([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchActive() }, [fetchActive])

  // Keep screen awake during active delivery (prevents GPS from stopping)
  useEffect(() => {
    if (deliveries.length === 0) return
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
  }, [deliveries.length])

  // Heartbeat: keep driver online while on active delivery page
  useEffect(() => {
    if (deliveries.length === 0) return
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
  }, [deliveries.length])

  // Track driver location while active
  useEffect(() => {
    if (deliveries.length === 0) return
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
  }, [deliveries.length])

  const updateStatus = async (newStatus: string) => {
    if (!delivery) return
    setUpdating(true)
    await fetch('/api/driver/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delivery_id: delivery.id, status: newStatus }),
    })
    if (newStatus === 'delivered') {
      // If there are other deliveries, refresh; otherwise show completed
      if (deliveries.length > 1) {
        setActiveIdx(0)
        setDeliveryPhoto(null)
        setPhotoPreview('')
        await fetchActive()
      } else {
        setCompleted(true)
      }
    } else {
      await fetchActive()
    }
    setUpdating(false)
  }

  // One tap at the shop = picked up AND on the way. The driver opens navigation
  // to the customer immediately and never has to come back to the app to tap a
  // second "Heading to Customer" button. Two sequential updates because the API
  // only allows assigned->picked_up->delivering one step at a time.
  const handlePickupAndDeliver = async () => {
    if (!delivery || updating) return
    setUpdating(true)
    try {
      const r1 = await fetch('/api/driver/update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivery_id: delivery.id, status: 'picked_up' }),
      })
      if (r1.ok) {
        await fetch('/api/driver/update', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ delivery_id: delivery.id, status: 'delivering' }),
        })
      }
      await fetchActive()
    } finally {
      setUpdating(false)
    }
  }

  const handlePickupPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !delivery) return
    setUploadingPickup(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('delivery_id', delivery.id)
      fd.append('type', 'pickup')
      const res = await fetch('/api/driver/delivery-photo', { method: 'POST', body: fd })
      if (res.ok) {
        const d = await res.json()
        setPickupPhotoUrl(d.url || 'saved')
      }
    } finally {
      setUploadingPickup(false)
      if (pickupInputRef.current) pickupInputRef.current.value = ''
    }
  }

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setDeliveryPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleDeliveryComplete = async () => {
    if (!delivery || !deliveryPhoto) return
    setUploadingPhoto(true)
    try {
      const formData = new FormData()
      formData.append('file', deliveryPhoto)
      formData.append('delivery_id', delivery.id)
      const uploadRes = await fetch('/api/driver/delivery-photo', { method: 'POST', body: formData })
      if (!uploadRes.ok) {
        const err = await uploadRes.json()
        alert(err.error || 'Photo upload failed')
        setUploadingPhoto(false)
        return
      }
      await updateStatus('delivered')
    } catch {
      alert('Failed to upload photo. Please try again.')
    }
    setUploadingPhoto(false)
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>

  if (completed) {
    return (
      <div style={{ background: '#fff', borderRadius: 16, padding: 60, textAlign: 'center', border: '1px solid #D1FAE5' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: '#065F46', marginBottom: 8 }}>Delivery Complete!</h2>
        <p style={{ fontSize: 16, color: '#10B981', fontWeight: 700, marginBottom: 24 }}>
          Earned: ${(delivery?.driver_earnings ?? 0).toFixed(2)}
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

  if (deliveries.length === 0) {
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

  // Turn-by-turn destinations (coords preferred, address fallback).
  const shopMapsUrl = shopLat && shopLng
    ? `https://www.google.com/maps/dir/?api=1&destination=${shopLat},${shopLng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${delivery.order?.shop?.address}, ${delivery.order?.shop?.city}, ${delivery.order?.shop?.state}`)}`
  const customerMapsUrl = custLat && custLng
    ? `https://www.google.com/maps/dir/?api=1&destination=${custLat},${custLng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${delivery.order?.delivery_address}, ${delivery.order?.delivery_city}`)}`

  // Required proof-of-pickup photo gates the "Picked Up" button.
  const hasPickupPhoto = !!(delivery.pickup_photo_url || pickupPhotoUrl)

  return (
    <div>
      {/* Delivery Tabs (shown when batching) */}
      {deliveries.length > 1 && (
        <div style={{
          display: 'flex', gap: 8, marginBottom: 16,
        }}>
          {deliveries.map((d, i) => (
            <button
              key={d.id}
              onClick={() => { setActiveIdx(i); setDeliveryPhoto(null); setPhotoPreview('') }}
              style={{
                flex: 1, padding: '12px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: 14,
                background: i === activeIdx ? '#FF8C00' : '#fff',
                color: i === activeIdx ? '#fff' : '#333',
                boxShadow: i === activeIdx ? '0 2px 8px rgba(255,140,0,0.3)' : '0 1px 3px rgba(0,0,0,0.1)',
              }}
            >
              <div>Delivery {i + 1} of {deliveries.length}</div>
              <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, opacity: 0.85 }}>
                {d.order?.shop?.name || 'Shop'} — {d.status.replace(/_/g, ' ')}
              </div>
            </button>
          ))}
        </div>
      )}

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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Required proof-of-pickup photo (of the order) BEFORE Picked Up. */}
              <input
                ref={pickupInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePickupPhoto}
                style={{ display: 'none' }}
              />
              {hasPickupPhoto ? (
                <div style={{ color: '#0E9F6E', fontWeight: 700, fontSize: 14 }}>✓ Pickup photo saved</div>
              ) : (
                <>
                  <button
                    onClick={() => pickupInputRef.current?.click()}
                    disabled={uploadingPickup}
                    style={{
                      padding: '12px 24px', borderRadius: 8, fontSize: 15, fontWeight: 700,
                      background: '#1A1A2E', color: '#fff', border: 'none',
                      cursor: uploadingPickup ? 'wait' : 'pointer', opacity: uploadingPickup ? 0.6 : 1,
                    }}
                  >
                    {uploadingPickup ? 'Uploading…' : '📷 Take pickup photo'}
                  </button>
                  <p style={{ fontSize: 12.5, color: '#888', margin: 0 }}>
                    Required — snap a photo of the order before you head out.
                  </p>
                </>
              )}
              {/* A real anchor tap launches Maps reliably even in an installed PWA;
                  the onClick marks picked_up AND delivering in one go. Locked until
                  the pickup photo is taken. */}
              {hasPickupPhoto ? (
                <a
                  href={customerMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handlePickupAndDeliver()}
                  style={{
                    display: 'inline-block', padding: '12px 32px', borderRadius: 8, fontSize: 15, fontWeight: 700,
                    background: '#FF8C00', color: '#fff', border: 'none', cursor: 'pointer',
                    textDecoration: 'none', opacity: updating ? 0.6 : 1,
                  }}
                >
                  {updating ? 'Updating...' : 'Picked Up — Navigate to Customer'}
                </a>
              ) : (
                <button
                  disabled
                  style={{
                    padding: '12px 32px', borderRadius: 8, fontSize: 15, fontWeight: 700,
                    background: '#ccc', color: '#fff', border: 'none', cursor: 'not-allowed',
                  }}
                >
                  🔒 Picked Up — Navigate to Customer
                </button>
              )}
            </div>
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
            <div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoSelect}
                style={{ display: 'none' }}
              />
              {!photoPreview ? (
                <button
                  onClick={() => photoInputRef.current?.click()}
                  style={{
                    padding: '12px 32px', borderRadius: 8, fontSize: 15, fontWeight: 700,
                    background: '#10B981', color: '#fff', border: 'none', cursor: 'pointer',
                  }}
                >
                  📷 Take Photo &amp; Complete
                </button>
              ) : (
                <div>
                  <div style={{ marginBottom: 12 }}>
                    <img
                      src={photoPreview}
                      alt="Delivery proof"
                      style={{ maxWidth: 280, maxHeight: 200, borderRadius: 10, border: '2px solid #10B981' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    <button
                      onClick={() => { setDeliveryPhoto(null); setPhotoPreview(''); photoInputRef.current?.click() }}
                      style={{
                        padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700,
                        background: '#f5f5f5', color: '#666', border: 'none', cursor: 'pointer',
                      }}
                    >
                      Retake
                    </button>
                    <button
                      onClick={handleDeliveryComplete}
                      disabled={uploadingPhoto || updating}
                      style={{
                        padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 700,
                        background: '#10B981', color: '#fff', border: 'none', cursor: 'pointer',
                        opacity: (uploadingPhoto || updating) ? 0.7 : 1,
                      }}
                    >
                      {uploadingPhoto ? 'Uploading...' : updating ? 'Completing...' : '✅ Confirm Delivery'}
                    </button>
                  </div>
                </div>
              )}
              <p style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
                Photo proof is required to complete delivery
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Order Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #FFE8D6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#888', marginBottom: 8 }}>PICKUP</h3>
              <p style={{ fontWeight: 700, fontSize: 16 }}>{delivery.order?.shop?.name}</p>
              <p style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                {delivery.order?.shop?.address}, {delivery.order?.shop?.city}
              </p>
              {delivery.order?.status && (
                <div style={{
                  display: 'inline-block', marginTop: 8, padding: '4px 12px', borderRadius: 6,
                  fontSize: 12, fontWeight: 700,
                  background: delivery.order.status === 'ready_for_pickup' ? '#D1FAE5' :
                    delivery.order.status === 'preparing' ? '#FEF3C7' :
                    delivery.order.status === 'confirmed' ? '#DBEAFE' : '#F3F4F6',
                  color: delivery.order.status === 'ready_for_pickup' ? '#065F46' :
                    delivery.order.status === 'preparing' ? '#92400E' :
                    delivery.order.status === 'confirmed' ? '#1E40AF' : '#374151',
                }}>
                  {delivery.order.status === 'ready_for_pickup' ? '✅ Ready for Pickup' :
                   delivery.order.status === 'preparing' ? '🍩 Preparing...' :
                   delivery.order.status === 'confirmed' ? '📋 Order Confirmed' :
                   delivery.order.status === 'pending' ? '⏳ Pending' :
                   delivery.order.status}
                </div>
              )}
              {delivery.order?.shop?.phone && (
                <a href={`tel:${delivery.order.shop.phone}`} style={{ display: 'block', marginTop: 6, fontSize: 13, color: '#3B82F6', textDecoration: 'none', fontWeight: 600 }}>
                  📞 Call Shop: {delivery.order.shop.phone}
                </a>
              )}
            </div>
            {(delivery.status === 'assigned') && (
              <a
                href={shopMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  background: '#3B82F6', color: '#fff', border: 'none', cursor: 'pointer',
                  whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4,
                  textDecoration: 'none',
                }}
              >
                🧭 Navigate
              </a>
            )}
          </div>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #FFE8D6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#888', marginBottom: 12 }}>DELIVER TO</h3>
              <p style={{ fontWeight: 700, fontSize: 16 }}>{delivery.order?.customer?.name || 'Customer'}</p>
              {delivery.order?.customer?.phone && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, color: '#666' }}>
                      📞 {delivery.order.customer.phone}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/driver/contact', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ delivery_id: delivery.id, message: `Your DonutDash driver is on the way with your order! 🍩` }),
                          })
                          if (res.ok) alert('Message sent to customer!')
                          else { const d = await res.json(); alert(d.error || 'Failed to send message') }
                        } catch { alert('Failed to send message') }
                      }}
                      style={{ background: '#FF1493', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      On My Way
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/driver/contact', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ delivery_id: delivery.id, message: `Your DonutDash driver has arrived! Please come to the door. 🚗` }),
                          })
                          if (res.ok) alert('Message sent to customer!')
                          else { const d = await res.json(); alert(d.error || 'Failed to send message') }
                        } catch { alert('Failed to send message') }
                      }}
                      style={{ background: '#10B981', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      I'm Here
                    </button>
                    <button
                      onClick={async () => {
                        const msg = prompt('Type your message to the customer:')
                        if (!msg) return
                        try {
                          const res = await fetch('/api/driver/contact', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ delivery_id: delivery.id, message: `DonutDash: ${msg}` }),
                          })
                          if (res.ok) alert('Message sent to customer!')
                          else { const d = await res.json(); alert(d.error || 'Failed to send message') }
                        } catch { alert('Failed to send message') }
                      }}
                      style={{ background: '#6366F1', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Custom Message
                    </button>
                  </div>
                </div>
              )}
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
              <a
                href={customerMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  background: '#10B981', color: '#fff', border: 'none', cursor: 'pointer',
                  whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4,
                  textDecoration: 'none',
                }}
              >
                🧭 Navigate
              </a>
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
          <span style={{ color: '#10B981' }}>${(delivery.driver_earnings ?? 0).toFixed(2)}</span>
        </div>
      </div>

      {/* Chat with Customer */}
      {delivery.order?.id && (
        <div style={{ marginTop: 16 }}>
          <ChatBox orderId={delivery.order.id} currentRole="driver" />
        </div>
      )}
    </div>
  )
}
