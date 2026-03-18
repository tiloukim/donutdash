'use client'

import { useState, useEffect, useRef, use } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const DeliveryMap = dynamic(() => import('@/components/DeliveryMap'), { ssr: false })

const STATUS_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'Order Received', color: '#F59E0B', icon: '📋' },
  confirmed: { label: 'Confirmed', color: '#3B82F6', icon: '✓' },
  preparing: { label: 'Preparing', color: '#8B5CF6', icon: '👨‍🍳' },
  ready_for_pickup: { label: 'Ready for Pickup', color: '#10B981', icon: '📦' },
  picked_up: { label: 'Driver Picked Up', color: '#FF8C00', icon: '🏪' },
  delivering: { label: 'On the Way', color: '#FF8C00', icon: '🚗' },
  delivered: { label: 'Delivered', color: '#10B981', icon: '✅' },
  cancelled: { label: 'Cancelled', color: '#EF4444', icon: '✗' },
}

const STATUS_MESSAGES: Record<string, string> = {
  confirmed: 'The shop has confirmed your order!',
  preparing: 'Your order is being prepared!',
  ready_for_pickup: 'Your order is ready for pickup!',
  picked_up: 'A driver has picked up your order!',
  delivering: 'Your order is on the way!',
  delivered: 'Your order has been delivered!',
  cancelled: 'Your order has been cancelled.',
}

export default function OrderTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [order, setOrder] = useState<any>(null)
  const [tracking, setTracking] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [statusUpdate, setStatusUpdate] = useState<string | null>(null)
  const prevStatusRef = useRef<string | null>(null)
  const alertAudioRef = useRef<HTMLAudioElement | null>(null)

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    // Pre-load audio on first interaction
    const unlock = () => {
      if (!alertAudioRef.current) {
        alertAudioRef.current = new Audio('/order-alert.wav')
      }
      alertAudioRef.current.volume = 0.01
      alertAudioRef.current.play().then(() => {
        alertAudioRef.current!.pause()
        alertAudioRef.current!.currentTime = 0
        alertAudioRef.current!.volume = 1.0
      }).catch(() => {})
    }
    document.addEventListener('click', unlock, { once: true })
    document.addEventListener('touchstart', unlock, { once: true })
    return () => {
      document.removeEventListener('click', unlock)
      document.removeEventListener('touchstart', unlock)
    }
  }, [])

  useEffect(() => {
    // Fetch order details
    fetch(`/api/orders/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setOrder(data)
        if (data) prevStatusRef.current = data.status
      })
      .finally(() => setLoading(false))
  }, [id])

  // Poll for order status updates and driver tracking
  useEffect(() => {
    if (!order) return
    const finalStatuses = ['delivered', 'cancelled']
    if (finalStatuses.includes(order.status)) return

    const poll = () => {
      // Refresh order status
      fetch(`/api/orders/${id}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data) return
          // Detect status change
          if (prevStatusRef.current && data.status !== prevStatusRef.current) {
            const msg = STATUS_MESSAGES[data.status]
            if (msg) {
              // Show in-page notification
              setStatusUpdate(msg)
              setTimeout(() => setStatusUpdate(null), 5000)

              // Play sound
              if (alertAudioRef.current) {
                alertAudioRef.current.currentTime = 0
                alertAudioRef.current.play().catch(() => {})
                // Stop after 2 seconds (don't loop for customer)
                setTimeout(() => {
                  if (alertAudioRef.current) {
                    alertAudioRef.current.pause()
                    alertAudioRef.current.currentTime = 0
                  }
                }, 2000)
              }

              // Browser notification (works even if tab is in background)
              if ('Notification' in window && Notification.permission === 'granted') {
                const statusInfo = STATUS_LABELS[data.status]
                new Notification(`DonutDash: ${statusInfo?.label || 'Order Update'}`, {
                  body: msg,
                  icon: '/logo.png',
                  tag: `order-${id}-${data.status}`,
                })
              }
            }
          }
          prevStatusRef.current = data.status
          setOrder(data)
        })
        .catch(() => {})

      // Fetch driver tracking
      fetch(`/api/driver/track/${id}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setTracking(data) })
        .catch(() => {})
    }

    poll()
    const interval = setInterval(poll, 5000)
    return () => clearInterval(interval)
  }, [id, order?.status])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      Loading...
    </div>
  )

  if (!order) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 48 }}>🔍</div>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Order Not Found</h1>
      <Link href="/" style={{ color: '#FF8C00', fontWeight: 600 }}>Back to Home</Link>
    </div>
  )

  const statusInfo = STATUS_LABELS[order.status] || STATUS_LABELS.pending
  const shopLat = order.shop?.lat
  const shopLng = order.shop?.lng
  const hasMap = tracking?.location && shopLat && shopLng

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px', minHeight: '100vh' }}>
      <Link href="/orders" style={{ color: '#FF8C00', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
        ← My Orders
      </Link>

      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1A1A2E', marginTop: 16, marginBottom: 4 }}>
        Track Order
      </h1>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
        #{id.slice(0, 8)}
      </p>

      {/* Status Update Toast */}
      {statusUpdate && (
        <div style={{
          background: '#FF8C00', color: '#fff', borderRadius: 12,
          padding: '14px 20px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 10,
          animation: 'slideIn 0.3s ease',
          boxShadow: '0 4px 16px rgba(255, 140, 0, 0.3)',
        }}>
          <span style={{ fontSize: 20 }}>🔔</span>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{statusUpdate}</span>
        </div>
      )}

      {/* Status Badge */}
      <div style={{
        background: `${statusInfo.color}15`,
        borderRadius: 12, padding: 20, textAlign: 'center',
        border: `1px solid ${statusInfo.color}30`, marginBottom: 20,
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>{statusInfo.icon}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: statusInfo.color }}>{statusInfo.label}</div>
        {tracking?.estimated_duration_min && (
          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
            Est. {tracking.estimated_duration_min} min
          </div>
        )}
      </div>

      {/* Status Timeline */}
      {order.status !== 'cancelled' && (
        <div style={{
          background: '#fff', borderRadius: 12, padding: '16px 20px',
          border: '1px solid #FFE8D6', marginBottom: 20,
        }}>
          {(() => {
            const steps = [
              { key: 'pending', label: 'Order Placed', icon: '📋' },
              { key: 'confirmed', label: 'Shop Confirmed', icon: '✓' },
              { key: 'preparing', label: 'Preparing', icon: '👨‍🍳' },
              { key: 'ready_for_pickup', label: 'Ready', icon: '📦' },
              { key: 'picked_up', label: 'Picked Up', icon: '🏪' },
              { key: 'delivering', label: 'On the Way', icon: '🚗' },
              { key: 'delivered', label: 'Delivered', icon: '✅' },
            ]
            const statusOrder = steps.map(s => s.key)
            const currentIdx = statusOrder.indexOf(order.status)
            return (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, overflowX: 'auto' }}>
                {steps.map((step, i) => {
                  const done = i <= currentIdx
                  const isCurrent = i === currentIdx
                  return (
                    <div key={step.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 36 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: 12,
                        background: done ? (isCurrent ? '#FF8C00' : '#10B981') : '#f0f0f0',
                        color: done ? '#fff' : '#bbb',
                        fontWeight: 700,
                        border: isCurrent ? '2px solid #FF8C00' : 'none',
                        boxShadow: isCurrent ? '0 0 0 3px rgba(255,140,0,0.2)' : 'none',
                      }}>
                        {step.icon}
                      </div>
                      <div style={{ fontSize: 9, fontWeight: 600, color: done ? '#333' : '#bbb', marginTop: 4, textAlign: 'center', lineHeight: 1.2 }}>
                        {step.label}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* Live Map */}
      {hasMap && (
        <div style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 20, height: 250, border: '1px solid #FFE8D6' }}>
          <DeliveryMap
            shopLat={shopLat}
            shopLng={shopLng}
            customerLat={order.delivery_lat}
            customerLng={order.delivery_lng}
            driverLat={tracking.location.lat}
            driverLng={tracking.location.lng}
          />
        </div>
      )}

      {/* Driver Info */}
      {tracking?.driver && (
        <div style={{
          background: '#fff', borderRadius: 12, padding: 16,
          border: '1px solid #FFE8D6', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%', background: '#FF8C00',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 20, fontWeight: 700,
          }}>
            {tracking.driver.name?.[0] || '?'}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{tracking.driver.name}</div>
            <div style={{ fontSize: 12, color: '#888' }}>Your delivery driver</div>
          </div>
        </div>
      )}

      {/* Order Items */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #FFE8D6' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#888', marginBottom: 12 }}>ORDER DETAILS</h3>
        {order.items?.map((item: any) => (
          <div key={item.id} style={{
            display: 'flex', justifyContent: 'space-between', padding: '8px 0',
            borderBottom: '1px solid #f5f5f5',
          }}>
            <span style={{ fontSize: 14 }}>{item.name} x{item.quantity}</span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>${(item.price * item.quantity).toFixed(2)}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid #eee', marginTop: 8, paddingTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16 }}>
            <span>Total</span>
            <span style={{ color: '#FF8C00' }}>${order.total?.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
