'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function DriverDashboard() {
  const [isOnline, setIsOnline] = useState(false)
  const [offer, setOffer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [countdown, setCountdown] = useState(0)
  const [responding, setResponding] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [driverId, setDriverId] = useState<string | null>(null)
  const [driverStatus, setDriverStatus] = useState<string | null>(null)
  const [docProgress, setDocProgress] = useState({ approved: 0, total: 7 })
  const watchIdRef = useRef<number | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const alertAudioRef = useRef<HTMLAudioElement | null>(null)
  const prevOfferIdRef = useRef<string | null>(null)
  const supabaseRef = useRef(createClient())

  // Fetch full offer details from API (needed for nested joins that realtime doesn't provide)
  const fetchOfferDetails = useCallback(async () => {
    const res = await fetch('/api/driver/offer')
    const data = await res.json()
    if (data?.id) setOffer(data)
  }, [])

  // Check online status and existing offer on mount
  useEffect(() => {
    Promise.all([
      fetch('/api/driver/online').then(r => r.json()).catch(() => ({ online: false })),
      fetch('/api/driver/offer').then(r => r.json()).catch(() => null),
      fetch('/api/me').then(r => r.json()).catch(() => ({ user: null })),
    ]).then(async ([statusData, offerData, meData]) => {
      if (statusData?.online) setIsOnline(true)
      if (offerData?.id) {
        setOffer(offerData)
        setIsOnline(true)
      }
      if (meData?.user?.id) {
        setDriverId(meData.user.id)
        setDriverStatus(meData.user.driver_status || null)
      }
      // Fetch document progress
      try {
        const docRes = await fetch('/api/driver/documents')
        const docData = await docRes.json()
        const docs = docData.documents || []
        setDocProgress({ approved: docs.filter((d: any) => d.status === 'approved').length, total: 7 })
      } catch {}
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // Request notification permission when going online
  useEffect(() => {
    if (isOnline && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [isOnline])

  // Auto-unlock audio on page load and any interaction
  useEffect(() => {
    const unlock = async () => {
      const { unlockAudio } = await import('@/lib/alert-sound')
      unlockAudio()
      if (!alertAudioRef.current) {
        alertAudioRef.current = new Audio('/alert.wav')
        alertAudioRef.current.loop = true
      }
      alertAudioRef.current.volume = 0.01
      alertAudioRef.current.play().then(() => {
        setTimeout(() => {
          if (alertAudioRef.current) {
            alertAudioRef.current.pause()
            alertAudioRef.current.currentTime = 0
            alertAudioRef.current.volume = 1.0
          }
        }, 100)
      }).catch(() => {})
    }
    // Try immediately on mount
    unlock()
    const t1 = setTimeout(unlock, 500)
    const t2 = setTimeout(unlock, 1500)
    // Also unlock on any user interaction
    const events = ['click', 'touchstart', 'touchend', 'keydown', 'scroll', 'pointerdown']
    events.forEach(e => document.addEventListener(e, unlock, { once: true, passive: true }))
    return () => { clearTimeout(t1); clearTimeout(t2); events.forEach(e => document.removeEventListener(e, unlock)) }
  }, [])

  // Auto-request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Alert when new offer arrives
  useEffect(() => {
    if (!offer || offer.id === prevOfferIdRef.current) return
    prevOfferIdRef.current = offer.id

    // Play loud urgent alert until driver responds
    import('@/lib/alert-sound').then(({ playUrgentAlertWithBackup }) => {
      playUrgentAlertWithBackup('/alert.wav')
    }).catch(() => {})

    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      const shopName = offer.delivery?.order?.shop?.name || 'New Order'
      const earnings = (offer.delivery?.driver_earnings || 4.00).toFixed(2)
      new Notification('New Delivery Offer!', {
        body: `${shopName} - Earn $${earnings}`,
        icon: '/logo.png',
        tag: 'delivery-offer',
        requireInteraction: true,
      })
    }
  }, [offer])

  // Keep screen awake while online (prevents GPS from stopping)
  useEffect(() => {
    if (!isOnline) return
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
  }, [isOnline])

  // Countdown timer for offer
  useEffect(() => {
    if (!offer) { setCountdown(0); return }
    const expiresAt = new Date(offer.expires_at).getTime()

    const tick = () => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
      setCountdown(remaining)
      if (remaining <= 0) {
        setOffer(null)
        // Check for new offer
        fetch('/api/driver/offer').then(r => r.json()).then(data => {
          if (data?.id) setOffer(data)
        })
      }
    }
    tick()
    const i = setInterval(tick, 1000)
    return () => clearInterval(i)
  }, [offer])

  // GPS tracking when online
  useEffect(() => {
    if (!isOnline) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      return
    }

    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported')
      return
    }

    let lastSentAt = 0

    const sendLocation = (pos: GeolocationPosition) => {
      // Throttle: send at most every 5 seconds
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
      }).catch(console.error)
    }

    // watchPosition for real-time movement detection
    watchIdRef.current = navigator.geolocation.watchPosition(
      sendLocation,
      (err) => setLocationError(err.message),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    )

    // Backup: poll getCurrentPosition every 8 seconds
    // (watchPosition can stall on some mobile browsers)
    const gpsInterval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        sendLocation,
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 }
      )
    }, 8000)

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      clearInterval(gpsInterval)
    }
  }, [isOnline])

  // Supabase Realtime: listen for new delivery offers in real-time
  useEffect(() => {
    if (!isOnline || !driverId || offer) return

    const supabase = supabaseRef.current
    const channel = supabase
      .channel('driver-offers')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dd_delivery_offers',
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          if (payload.new?.status === 'pending') {
            // New offer arrived — fetch full details from API
            fetchOfferDetails()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isOnline, driverId, offer, fetchOfferDetails])

  // Fallback polling: check for offers every 10s in case realtime misses something
  useEffect(() => {
    if (!isOnline || offer) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    const checkOffer = () => {
      fetch('/api/driver/offer').then(r => r.json()).then(data => {
        if (data?.id) setOffer(data)
      }).catch(() => {})
    }

    intervalRef.current = setInterval(checkOffer, 10000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isOnline, offer])

  // Heartbeat: keep online status alive while on this page
  useEffect(() => {
    if (!isOnline) return
    const heartbeat = setInterval(() => {
      fetch('/api/driver/online', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ online: true }),
      }).catch(() => {})
    }, 30000) // every 30 seconds
    return () => clearInterval(heartbeat)
  }, [isOnline])

  const toggleOnline = async () => {
    const newState = !isOnline
    // Pre-load and unlock audio on Go Online tap (mobile browsers require user gesture)
    if (newState) {
      try {
        if (!alertAudioRef.current) {
          alertAudioRef.current = new Audio('/alert.wav')
          alertAudioRef.current.loop = true
        }
        // Play silently to unlock audio on mobile, then pause
        alertAudioRef.current.volume = 0.01
        await alertAudioRef.current.play().catch(() => {})
        setTimeout(() => {
          if (alertAudioRef.current) {
            alertAudioRef.current.pause()
            alertAudioRef.current.currentTime = 0
            alertAudioRef.current.volume = 1.0
          }
        }, 100)
      } catch {
        // Audio not available
      }
    }
    // When going online, get GPS first so driver isn't at (0,0)
    if (newState && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          })
        )
        // Send location before going online
        await fetch('/api/driver/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
          }),
        })
      } catch {
        // GPS failed — proceed anyway, watchPosition will update later
      }
    }
    await fetch('/api/driver/online', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ online: newState }),
    })
    setIsOnline(newState)
    if (!newState) {
      setOffer(null)
      // Stop alert sound if playing
      import('@/lib/alert-sound').then(({ stopUrgentAlert }) => stopUrgentAlert()).catch(() => {})
      if (alertAudioRef.current) {
        alertAudioRef.current.pause()
        alertAudioRef.current.currentTime = 0
      }
    }
  }

  const respondToOffer = async (action: 'accept' | 'decline') => {
    if (!offer) return
    setResponding(true)
    // Stop alert sound
    import('@/lib/alert-sound').then(({ stopUrgentAlert }) => stopUrgentAlert()).catch(() => {})
    if (alertAudioRef.current) {
      alertAudioRef.current.pause()
      alertAudioRef.current.currentTime = 0
    }
    const res = await fetch('/api/driver/offer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offer_id: offer.id, action }),
    })

    if (res.ok) {
      const data = await res.json()
      if (data.accepted) {
        window.location.href = '/driver/active'
        return
      }
      setOffer(null)
    } else {
      setOffer(null)
    }
    setResponding(false)
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>

  // Gate: driver must be approved before going online
  if (driverStatus !== 'approved') {
    return (
      <div>
        <div style={{
          background: '#fff', borderRadius: 16, padding: 32,
          border: '2px solid #FFE8D6', textAlign: 'center',
        }}>
          {driverStatus === 'pending_approval' ? (
            <>
              <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', marginBottom: 8 }}>
                Pending Admin Approval
              </h2>
              <p style={{ color: '#666', fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
                All your documents have been submitted. An admin will review and approve your account shortly.
                You&apos;ll be able to go online and accept deliveries once approved.
              </p>
              <div style={{
                background: '#FEF3C7', borderRadius: 12, padding: '12px 20px',
                display: 'inline-block', fontSize: 13, color: '#92400E', fontWeight: 600,
              }}>
                Documents: {docProgress.approved}/{docProgress.total} approved
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', marginBottom: 8 }}>
                Complete Your Onboarding
              </h2>
              <p style={{ color: '#666', fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
                Before you can start delivering, you need to upload your documents and get approved.
              </p>

              {/* Progress bar */}
              <div style={{ maxWidth: 400, margin: '0 auto 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  <span style={{ color: '#666' }}>Documents</span>
                  <span style={{ color: docProgress.approved === docProgress.total ? '#10B981' : '#FF8C00' }}>
                    {docProgress.approved}/{docProgress.total} approved
                  </span>
                </div>
                <div style={{ background: '#F3F4F6', borderRadius: 8, height: 10, overflow: 'hidden' }}>
                  <div style={{
                    background: docProgress.approved === docProgress.total ? '#10B981' : '#FF8C00',
                    height: '100%', borderRadius: 8, transition: 'width 0.3s',
                    width: `${(docProgress.approved / docProgress.total) * 100}%`,
                  }} />
                </div>
              </div>

              {/* Steps */}
              <div style={{ textAlign: 'left', maxWidth: 400, margin: '0 auto 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <span style={{ fontSize: 20 }}>{docProgress.approved >= 1 ? '✅' : '1️⃣'}</span>
                  <span style={{ fontSize: 14, color: '#333' }}>Upload selfie for identity verification</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <span style={{ fontSize: 20 }}>{docProgress.approved >= 3 ? '✅' : '2️⃣'}</span>
                  <span style={{ fontSize: 14, color: '#333' }}>Upload driver&apos;s license (front &amp; back)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <span style={{ fontSize: 20 }}>{docProgress.approved >= 4 ? '✅' : '3️⃣'}</span>
                  <span style={{ fontSize: 14, color: '#333' }}>Submit W-9 tax form</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <span style={{ fontSize: 20 }}>{docProgress.approved >= 6 ? '✅' : '4️⃣'}</span>
                  <span style={{ fontSize: 14, color: '#333' }}>Upload insurance &amp; vehicle registration</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
                  <span style={{ fontSize: 20 }}>{docProgress.approved >= 7 ? '✅' : '5️⃣'}</span>
                  <span style={{ fontSize: 14, color: '#333' }}>Sign contractor agreement</span>
                </div>
              </div>

              <a href="/driver/documents" style={{
                display: 'inline-block', padding: '14px 40px', borderRadius: 50,
                fontSize: 16, fontWeight: 700, background: '#FF8C00', color: '#fff',
                textDecoration: 'none',
              }}>
                Upload Documents
              </a>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Online Toggle */}
      <div style={{
        background: isOnline ? '#ECFDF5' : '#fff',
        borderRadius: 16, padding: 24,
        border: `2px solid ${isOnline ? '#10B981' : '#FFE8D6'}`,
        marginBottom: 24, textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>{isOnline ? '🟢' : '⚪'}</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: isOnline ? '#065F46' : '#1A1A2E', marginBottom: 8 }}>
          {isOnline ? 'You\'re Online' : 'You\'re Offline'}
        </h2>
        <p style={{ color: isOnline ? '#047857' : '#888', fontSize: 14, marginBottom: 16 }}>
          {isOnline ? 'Waiting for delivery offers...' : 'Go online to receive delivery offers'}
        </p>
        <button onClick={toggleOnline} style={{
          padding: '14px 40px', borderRadius: 50, fontSize: 16, fontWeight: 700, border: 'none', cursor: 'pointer',
          background: isOnline ? '#EF4444' : '#10B981', color: '#fff',
        }}>
          {isOnline ? 'Go Offline' : 'Go Online'}
        </button>
        {locationError && <p style={{ color: '#EF4444', fontSize: 12, marginTop: 8 }}>{locationError}</p>}
      </div>

      {/* Delivery Offer */}
      {offer && (
        <div style={{
          background: '#FFF7ED', borderRadius: 16, padding: 24,
          border: '2px solid #FF8C00', animation: 'pulse 2s infinite',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#FF8C00' }}>New Delivery Offer!</h3>
            <div style={{
              width: 50, height: 50, borderRadius: '50%',
              background: countdown <= 10 ? '#EF4444' : '#FF8C00',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 800,
            }}>
              {countdown}
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
              {offer.delivery?.order?.shop?.name || 'Shop'}
            </div>
            <div style={{ fontSize: 13, color: '#666' }}>
              📍 {offer.delivery?.order?.shop?.address}, {offer.delivery?.order?.shop?.city}
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#888', marginBottom: 4 }}>DELIVER TO</div>
            <div style={{ fontSize: 14 }}>
              {offer.delivery?.order?.delivery_address}, {offer.delivery?.order?.delivery_city}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: 13, color: '#888' }}>Order total: </span>
              <span style={{ fontWeight: 700 }}>${offer.delivery?.order?.total?.toFixed(2)}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#10B981' }}>
              ${(offer.delivery?.driver_earnings || 4.00).toFixed(2)}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => respondToOffer('decline')} disabled={responding} style={{
              flex: 1, padding: '14px', borderRadius: 12, fontSize: 16, fontWeight: 700,
              background: '#fff', color: '#EF4444', border: '2px solid #EF4444', cursor: 'pointer',
            }}>
              Decline
            </button>
            <button onClick={() => respondToOffer('accept')} disabled={responding} style={{
              flex: 2, padding: '14px', borderRadius: 12, fontSize: 16, fontWeight: 700,
              background: '#10B981', color: '#fff', border: 'none', cursor: 'pointer',
            }}>
              {responding ? 'Accepting...' : 'Accept'}
            </button>
          </div>
        </div>
      )}

      {/* Available Deliveries + Idle state when online but no offer */}
      {isOnline && !offer && (
        <AvailableDeliveries />
      )}
    </div>
  )
}

function AvailableDeliveries() {
  const [deliveries, setDeliveries] = useState<any[]>([])
  const [claiming, setClaiming] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchAvailable = () => {
      fetch('/api/driver/available-orders')
        .then(r => r.json())
        .then(d => setDeliveries(d.deliveries || []))
        .catch(() => {})
    }
    fetchAvailable()
    const interval = setInterval(fetchAvailable, 15000)
    return () => clearInterval(interval)
  }, [])

  const claimDelivery = async (deliveryId: string) => {
    setClaiming(deliveryId)
    setError('')
    try {
      const res = await fetch('/api/driver/available-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivery_id: deliveryId }),
      })
      const data = await res.json()
      if (res.ok) {
        window.location.href = '/driver/active'
      } else {
        setError(data.error || 'Failed to claim')
        setDeliveries(prev => prev.filter(d => d.id !== deliveryId))
      }
    } catch { setError('Failed to claim delivery') }
    finally { setClaiming(null) }
  }

  return (
    <div>
      {deliveries.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E', marginBottom: 12 }}>
            Available Deliveries ({deliveries.length})
          </h3>
          {error && <div style={{ background: '#FEE2E2', borderRadius: 8, padding: '8px 12px', marginBottom: 10, color: '#DC2626', fontSize: 13 }}>{error}</div>}
          {deliveries.map(d => {
            const order = d.order
            const shop = order?.shop
            return (
              <div key={d.id} style={{
                background: '#fff', borderRadius: 14, border: '2px solid #FFE8D6', padding: 18, marginBottom: 12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{shop?.name || 'Shop'}</div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{shop?.address}, {shop?.city}</div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#10B981' }}>
                    ${(d.driver_earnings || 4.00).toFixed(2)}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>Deliver to:</span> {order?.delivery_address}, {order?.delivery_city}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                  <div style={{ fontSize: 13, color: '#888' }}>
                    Order: ${order?.total?.toFixed(2) || '0.00'}
                    {d.distance_miles ? ` • ${d.distance_miles.toFixed(1)} mi` : ''}
                  </div>
                  <button
                    onClick={() => claimDelivery(d.id)}
                    disabled={claiming === d.id}
                    style={{
                      padding: '10px 24px', borderRadius: 10, border: 'none',
                      background: claiming === d.id ? '#9CA3AF' : '#10B981', color: '#fff',
                      fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    {claiming === d.id ? 'Accepting...' : 'Accept'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{
        background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center',
        border: '1px solid #FFE8D6',
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📡</div>
        <p style={{ color: '#888', fontSize: 15 }}>Scanning for nearby orders...</p>
        <p style={{ color: '#bbb', fontSize: 12, marginTop: 8 }}>You&apos;ll be notified when a delivery is available</p>
        <p style={{ color: '#FF8C00', fontSize: 11, marginTop: 12, background: '#FFF7ED', padding: '8px 12px', borderRadius: 8, display: 'inline-block' }}>
          Keep this tab open to receive offers and share your GPS
        </p>
      </div>
    </div>
  )
}
