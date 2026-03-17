'use client'

import { useState, useEffect, use } from 'react'
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

export default function OrderTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [order, setOrder] = useState<any>(null)
  const [tracking, setTracking] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch order details
    fetch(`/api/orders/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(setOrder)
      .finally(() => setLoading(false))
  }, [id])

  // Poll for driver tracking when order is in transit
  useEffect(() => {
    if (!order) return
    const trackable = ['confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'delivering']
    if (!trackable.includes(order.status)) return

    const fetchTracking = () => {
      fetch(`/api/driver/track/${id}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setTracking(data) })
        .catch(() => {})
    }

    fetchTracking()
    const interval = setInterval(fetchTracking, 5000)
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
      <Link href="/" style={{ color: '#FF8C00', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
        ← Back
      </Link>

      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1A1A2E', marginTop: 16, marginBottom: 4 }}>
        Track Order
      </h1>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
        #{id.slice(0, 8)}
      </p>

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
