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
    ]).then(([statusData, offerData, meData]) => {
      if (statusData?.online) setIsOnline(true)
      if (offerData?.id) {
        setOffer(offerData)
        setIsOnline(true)
      }
      if (meData?.user?.id) setDriverId(meData.user.id)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // Request notification permission when going online
  useEffect(() => {
    if (isOnline && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [isOnline])

  // Alert when new offer arrives
  useEffect(() => {
    if (!offer || offer.id === prevOfferIdRef.current) return
    prevOfferIdRef.current = offer.id

    // Play looping alert sound until driver responds
    try {
      if (!alertAudioRef.current) {
        alertAudioRef.current = new Audio('/alert.wav')
        alertAudioRef.current.loop = true
      }
      alertAudioRef.current.volume = 1.0
      alertAudioRef.current.currentTime = 0
      alertAudioRef.current.play().catch(() => {})
    } catch {
      // Audio not available
    }

    // Vibrate if supported
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 200])
    }

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

    const sendLocation = (pos: GeolocationPosition) => {
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

    watchIdRef.current = navigator.geolocation.watchPosition(
      sendLocation,
      (err) => setLocationError(err.message),
      { enableHighAccuracy: true, maximumAge: 5000 }
    )

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
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
    await fetch('/api/driver/online', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ online: newState }),
    })
    setIsOnline(newState)
    if (!newState) {
      setOffer(null)
      // Stop alert sound if playing
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

      {/* Idle state when online but no offer */}
      {isOnline && !offer && (
        <div style={{
          background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center',
          border: '1px solid #FFE8D6',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📡</div>
          <p style={{ color: '#888', fontSize: 15 }}>Scanning for nearby orders...</p>
          <p style={{ color: '#bbb', fontSize: 12, marginTop: 8 }}>You&apos;ll be notified when a delivery is available</p>
        </div>
      )}
    </div>
  )
}
