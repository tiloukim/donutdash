'use client'

import { useState, useEffect, useRef, use, useCallback } from 'react'
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

function StarRating({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const [hover, setHover] = useState(0)
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#555', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', gap: 4 }}>
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 2,
              fontSize: 28, lineHeight: 1, transition: 'transform 0.15s',
              transform: (hover === star) ? 'scale(1.2)' : 'scale(1)',
              color: star <= (hover || value) ? '#FF1493' : '#ddd',
              filter: star <= (hover || value) ? 'drop-shadow(0 1px 2px rgba(255,20,147,0.3))' : 'none',
            }}
            aria-label={`${star} star`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  )
}

export default function OrderTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [order, setOrder] = useState<any>(null)
  const [tracking, setTracking] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [statusUpdate, setStatusUpdate] = useState<string | null>(null)
  const prevStatusRef = useRef<string | null>(null)
  const alertAudioRef = useRef<HTMLAudioElement | null>(null)

  // Review state
  const [shopRating, setShopRating] = useState(0)
  const [driverRating, setDriverRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewSubmitted, setReviewSubmitted] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [existingReview, setExistingReview] = useState<any>(null)

  // Fetch existing review when order is delivered
  const fetchReview = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${id}/review`)
      if (res.ok) {
        const data = await res.json()
        if (data.review) {
          setExistingReview(data.review)
          setShopRating(data.review.shop_rating)
          setDriverRating(data.review.driver_rating)
          setReviewComment(data.review.comment || '')
          setReviewSubmitted(true)
        }
      }
    } catch {}
  }, [id])

  const submitReview = async () => {
    if (shopRating === 0 || driverRating === 0) {
      setReviewError('Please rate both the shop and the driver.')
      return
    }
    setReviewSubmitting(true)
    setReviewError(null)
    try {
      const res = await fetch(`/api/orders/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_rating: shopRating,
          driver_rating: driverRating,
          comment: reviewComment,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setReviewSubmitted(true)
        setExistingReview(data.review)
      } else {
        setReviewError(data.error || 'Failed to submit review.')
      }
    } catch {
      setReviewError('Network error. Please try again.')
    } finally {
      setReviewSubmitting(false)
    }
  }

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

  // Fetch existing review when order is delivered
  useEffect(() => {
    if (order?.status === 'delivered') {
      fetchReview()
    }
  }, [order?.status, fetchReview])

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
  // Customer sees driver map only from picked_up onwards
  const trackableForCustomer = ['picked_up', 'delivering']
  const hasMap = tracking?.location && shopLat && shopLng && trackableForCustomer.includes(order.status)

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

      {/* Review Section - only shown when delivered */}
      {order.status === 'delivered' && (
        <div style={{
          background: '#fff', borderRadius: 12, padding: 20,
          border: '1px solid #FFB6C1', marginTop: 20,
          boxShadow: '0 2px 12px rgba(255, 20, 147, 0.08)',
        }}>
          {reviewSubmitted ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#FF1493', marginBottom: 8 }}>
                Thank you for your review!
              </h3>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Shop</div>
                  <div style={{ color: '#FF1493', fontSize: 20, letterSpacing: 2 }}>
                    {'★'.repeat(shopRating)}{'☆'.repeat(5 - shopRating)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Driver</div>
                  <div style={{ color: '#FF1493', fontSize: 20, letterSpacing: 2 }}>
                    {'★'.repeat(driverRating)}{'☆'.repeat(5 - driverRating)}
                  </div>
                </div>
              </div>
              {reviewComment && (
                <p style={{ fontSize: 13, color: '#666', marginTop: 12, fontStyle: 'italic' }}>
                  &ldquo;{reviewComment}&rdquo;
                </p>
              )}
            </div>
          ) : (
            <>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#FF1493', marginBottom: 4 }}>
                Rate Your Experience
              </h3>
              <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
                How was your order? Your feedback helps us improve.
              </p>

              <StarRating value={shopRating} onChange={setShopRating} label="Shop Rating" />
              <StarRating value={driverRating} onChange={setDriverRating} label="Driver Rating" />

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#555', marginBottom: 6 }}>
                  Comments (optional)
                </div>
                <textarea
                  value={reviewComment}
                  onChange={e => setReviewComment(e.target.value)}
                  placeholder="Tell us about your experience..."
                  maxLength={500}
                  style={{
                    width: '100%', minHeight: 80, borderRadius: 8,
                    border: '1px solid #FFB6C1', padding: '10px 12px',
                    fontSize: 14, resize: 'vertical', outline: 'none',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#FF1493' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#FFB6C1' }}
                />
              </div>

              {reviewError && (
                <div style={{
                  background: '#FFF0F5', color: '#FF1493', borderRadius: 8,
                  padding: '8px 12px', fontSize: 13, marginBottom: 12,
                  border: '1px solid #FFB6C1',
                }}>
                  {reviewError}
                </div>
              )}

              <button
                onClick={submitReview}
                disabled={reviewSubmitting || shopRating === 0 || driverRating === 0}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 10,
                  background: (shopRating > 0 && driverRating > 0) ? '#FF1493' : '#FFB6C1',
                  color: '#fff', fontWeight: 700, fontSize: 15,
                  border: 'none', cursor: (shopRating > 0 && driverRating > 0) ? 'pointer' : 'not-allowed',
                  opacity: reviewSubmitting ? 0.7 : 1,
                  transition: 'background 0.2s, opacity 0.2s',
                }}
              >
                {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
