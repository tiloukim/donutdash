'use client'

import { useState, useEffect, useRef, use, useCallback } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import ChatBox from '@/components/ChatBox'
import DriverAvatar from '@/components/DriverAvatar'

const DeliveryMap = dynamic(() => import('@/components/DeliveryMap'), { ssr: false })

const STATUS_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  adjusted: { label: 'Order Adjusted — Please Confirm', color: '#DC2626', icon: '⚠️' },
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
  adjusted: 'The shop adjusted some items. Please review and confirm.',
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

  // Cancel state
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelSubmitting, setCancelSubmitting] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  // Dispute state
  const [disputeReason, setDisputeReason] = useState('')
  const [disputeDescription, setDisputeDescription] = useState('')
  const [disputeAmount, setDisputeAmount] = useState('')
  const [disputeSubmitting, setDisputeSubmitting] = useState(false)
  const [disputeError, setDisputeError] = useState<string | null>(null)
  const [existingDispute, setExistingDispute] = useState<any>(null)
  const [showDisputeForm, setShowDisputeForm] = useState(false)
  const [disputePhotos, setDisputePhotos] = useState<string[]>([])
  const [disputeUploading, setDisputeUploading] = useState(false)

  // Fetch existing dispute
  const fetchDispute = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${id}/dispute`)
      if (res.ok) {
        const data = await res.json()
        if (data.dispute) {
          setExistingDispute(data.dispute)
        }
      }
    } catch {}
  }, [id])

  const submitCancel = async () => {
    setCancelSubmitting(true)
    setCancelError(null)
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', cancellation_reason: cancelReason || undefined }),
      })
      const data = await res.json()
      if (res.ok && data.cancelled) {
        setOrder((prev: any) => ({ ...prev, status: 'cancelled' }))
        setShowCancelConfirm(false)
      } else {
        setCancelError(data.error || 'Failed to cancel order.')
      }
    } catch {
      setCancelError('Network error. Please try again.')
    } finally {
      setCancelSubmitting(false)
    }
  }

  const submitDispute = async () => {
    if (!disputeReason) {
      setDisputeError('Please select a reason.')
      return
    }
    setDisputeSubmitting(true)
    setDisputeError(null)
    try {
      const res = await fetch(`/api/orders/${id}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: disputeReason,
          description: disputeDescription,
          refund_amount: disputeAmount ? parseFloat(disputeAmount) : undefined,
          photo_urls: disputePhotos.length > 0 ? disputePhotos : undefined,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setExistingDispute(data.dispute)
        setShowDisputeForm(false)
      } else {
        setDisputeError(data.error || 'Failed to submit dispute.')
      }
    } catch {
      setDisputeError('Network error. Please try again.')
    } finally {
      setDisputeSubmitting(false)
    }
  }

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

  // Sound refs for different status alerts
  const readyAudioRef = useRef<HTMLAudioElement | null>(null)
  const knockAudioRef = useRef<HTMLAudioElement | null>(null)

  // Map status to which sound to play
  const STATUS_SOUNDS: Record<string, 'ready' | 'knock' | 'default'> = {
    ready_for_pickup: 'ready',
    delivered: 'knock',
    confirmed: 'default',
    preparing: 'default',
    picked_up: 'default',
    delivering: 'default',
  }

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    // Pre-load all audio on first interaction
    const unlock = () => {
      const audios = [
        { ref: alertAudioRef, src: '/order-alert.wav' },
        { ref: readyAudioRef, src: '/order-ready.wav' },
        { ref: knockAudioRef, src: '/door-knock.wav' },
      ]
      audios.forEach(({ ref, src }) => {
        if (!ref.current) ref.current = new Audio(src)
        ref.current.volume = 0.01
        ref.current.play().then(() => {
          ref.current!.pause()
          ref.current!.currentTime = 0
          ref.current!.volume = 1.0
        }).catch(() => {})
      })
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

  // Fetch existing review and dispute when order is delivered
  useEffect(() => {
    if (order?.status === 'delivered') {
      fetchReview()
      fetchDispute()
      if (!disputeAmount && order?.total) {
        setDisputeAmount(Number(order.total).toFixed(2))
      }
    }
  }, [order?.status, order?.total, fetchReview, fetchDispute])

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

              // Play the right sound for this status
              const soundType = STATUS_SOUNDS[data.status] || 'default'
              const audioRef = soundType === 'ready' ? readyAudioRef
                : soundType === 'knock' ? knockAudioRef
                : alertAudioRef
              if (audioRef.current) {
                audioRef.current.currentTime = 0
                audioRef.current.play().catch(() => {})
                setTimeout(() => {
                  if (audioRef.current) {
                    audioRef.current.pause()
                    audioRef.current.currentTime = 0
                  }
                }, soundType === 'knock' ? 5000 : 2000)
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
        {order.status === 'delivered' ? (
          <div style={{
            display: 'inline-block', marginTop: 8, padding: '6px 16px',
            borderRadius: 20, background: '#10B981', color: '#fff',
            fontSize: 14, fontWeight: 700,
          }}>
            Delivered
          </div>
        ) : order.status !== 'cancelled' && tracking?.eta_minutes != null && tracking.eta_minutes > 0 ? (
          <div style={{
            display: 'inline-block', marginTop: 8, padding: '6px 16px',
            borderRadius: 20, background: '#10B981', color: '#fff',
            fontSize: 14, fontWeight: 700,
          }}>
            Arriving in ~{tracking.eta_minutes} min
          </div>
        ) : tracking?.estimated_duration_min ? (
          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
            Est. {tracking.estimated_duration_min} min
          </div>
        ) : null}
      </div>

      {/* Adjusted Order — Confirm or Cancel */}
      {order.status === 'adjusted' && (
        <div style={{
          background: '#FEF3C7', borderRadius: 12, padding: 20,
          border: '2px solid #F59E0B', marginBottom: 20,
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#92400E', marginBottom: 8 }}>
            The shop adjusted your order
          </h3>
          <p style={{ fontSize: 14, color: '#92400E', lineHeight: 1.5, marginBottom: 16 }}>
            Some items were out of stock or changed. Please review the updated items below and confirm to proceed, or cancel for a full refund.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={async () => {
                await fetch(`/api/orders/${order.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: 'confirmed' }),
                })
                window.location.reload()
              }}
              style={{
                flex: 1, padding: '14px', borderRadius: 10, background: '#10B981', color: '#fff',
                fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: 16,
              }}
            >
              ✓ Confirm Adjusted Order
            </button>
            <button
              onClick={async () => {
                await fetch(`/api/orders/${order.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: 'cancelled', cancellation_reason: 'Customer declined adjusted order' }),
                })
                window.location.reload()
              }}
              style={{
                padding: '14px 20px', borderRadius: 10, background: '#FEE2E2', color: '#DC2626',
                fontWeight: 700, border: '1px solid #FCA5A5', cursor: 'pointer', fontSize: 14,
              }}
            >
              Cancel Order
            </button>
          </div>
        </div>
      )}

      {/* Cancel Order */}
      {(order.status === 'pending' || order.status === 'confirmed') && (
        <div style={{
          background: '#fff', borderRadius: 12, padding: 16,
          border: '1px solid #FEE2E2', marginBottom: 20,
        }}>
          {showCancelConfirm ? (
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#DC2626', marginBottom: 12 }}>
                Cancel this order?
              </h3>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Reason (optional)</div>
                <select
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: '1px solid #FCA5A5', fontSize: 14, outline: 'none',
                    fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box',
                  }}
                >
                  <option value="">Select a reason...</option>
                  <option value="Changed my mind">Changed my mind</option>
                  <option value="Ordered by mistake">Ordered by mistake</option>
                  <option value="Taking too long">Taking too long</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              {cancelError && (
                <div style={{
                  background: '#FEF2F2', color: '#DC2626', borderRadius: 8,
                  padding: '8px 12px', fontSize: 13, marginBottom: 12,
                  border: '1px solid #FCA5A5',
                }}>
                  {cancelError}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { setShowCancelConfirm(false); setCancelError(null) }}
                  style={{
                    flex: 1, padding: '11px 0', borderRadius: 10,
                    background: '#f5f5f5', color: '#666', fontWeight: 700, fontSize: 14,
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  Go Back
                </button>
                <button
                  onClick={submitCancel}
                  disabled={cancelSubmitting}
                  style={{
                    flex: 1, padding: '11px 0', borderRadius: 10,
                    background: '#DC2626', color: '#fff', fontWeight: 700, fontSize: 14,
                    border: 'none', cursor: 'pointer',
                    opacity: cancelSubmitting ? 0.7 : 1,
                  }}
                >
                  {cancelSubmitting ? 'Cancelling...' : 'Confirm Cancel'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <button
                onClick={() => setShowCancelConfirm(true)}
                style={{
                  padding: '10px 24px', borderRadius: 10,
                  background: 'none', color: '#DC2626', fontWeight: 700, fontSize: 14,
                  border: '1px solid #FCA5A5', cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
              >
                Cancel Order
              </button>
            </div>
          )}
        </div>
      )}

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
            driverHeading={tracking.location.heading}
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
          <DriverAvatar name={tracking.driver.name} url={tracking.driver.avatar_url} size={48} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{tracking.driver.name}</div>
            <div style={{ fontSize: 12, color: '#888' }}>Your delivery driver</div>
          </div>
        </div>
      )}

      {/* Chat with Driver */}
      {['confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'delivering'].includes(order.status) && (
        <div style={{ marginBottom: 20 }}>
          <ChatBox orderId={id} currentRole="customer" />
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

      {/* Delivery Proof Photo */}
      {order.status === 'delivered' && order.delivery_photo_url && (
        <div style={{
          background: '#fff', borderRadius: 12, padding: 16,
          border: '1px solid #D1FAE5', marginTop: 20,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#065F46', marginBottom: 12 }}>DELIVERY PROOF</h3>
          <img
            src={order.delivery_photo_url}
            alt="Delivery proof photo"
            style={{ maxWidth: 400, width: '100%', borderRadius: 10, border: '1px solid #E5E7EB' }}
          />
        </div>
      )}

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

      {/* Dispute / Report Issue Section - only shown when delivered */}
      {order.status === 'delivered' && (
        <div style={{
          background: '#fff', borderRadius: 12, padding: 20,
          border: '1px solid #FFB6C1', marginTop: 20,
          boxShadow: '0 2px 12px rgba(255, 20, 147, 0.08)',
        }}>
          {existingDispute ? (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#FF1493', marginBottom: 12 }}>
                Issue Reported
              </h3>
              <div style={{
                display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                background: existingDispute.status === 'pending' ? '#FFF3CD' :
                  existingDispute.status === 'approved' ? '#D1FAE5' :
                  existingDispute.status === 'rejected' ? '#FEE2E2' : '#DBEAFE',
                color: existingDispute.status === 'pending' ? '#856404' :
                  existingDispute.status === 'approved' ? '#065F46' :
                  existingDispute.status === 'rejected' ? '#991B1B' : '#1E40AF',
                marginBottom: 12,
              }}>
                {existingDispute.status.charAt(0).toUpperCase() + existingDispute.status.slice(1)}
              </div>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>
                <strong>Reason:</strong> {existingDispute.reason.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
              </div>
              {existingDispute.description && (
                <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>
                  <strong>Description:</strong> {existingDispute.description}
                </div>
              )}
              {existingDispute.status === 'refunded' && (
                <div style={{ fontSize: 13, color: '#10B981', marginBottom: 6, fontWeight: 600 }}>
                  Refund approved: ${Number(existingDispute.refund_amount).toFixed(2)}
                </div>
              )}
              {(() => {
                const photos: string[] = Array.isArray(existingDispute.photo_urls) ? existingDispute.photo_urls
                  : typeof existingDispute.photo_urls === 'string' ? JSON.parse(existingDispute.photo_urls)
                  : existingDispute.photo_url ? [existingDispute.photo_url] : []
                return photos.length > 0 ? (
                  <div style={{ marginTop: 8, marginBottom: 8 }}>
                    <strong style={{ fontSize: 13, color: '#666' }}>Your photos/videos:</strong>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                      {photos.map((url: string, i: number) => (
                        url.match(/\.(mp4|mov|webm)(\?|$)/i)
                          ? <video key={i} src={url} controls style={{ width: 160, maxHeight: 120, borderRadius: 8, border: '1px solid #ddd' }} />
                          : <img key={i} src={url} alt={`Evidence ${i + 1}`} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid #ddd' }} />
                      ))}
                    </div>
                  </div>
                ) : null
              })()}
              {existingDispute.admin_notes && (
                <div style={{
                  fontSize: 13, color: '#555', marginTop: 12, padding: '10px 12px',
                  background: '#F8F9FA', borderRadius: 8, border: '1px solid #E5E7EB',
                }}>
                  <strong>Admin response:</strong> {existingDispute.admin_notes}
                </div>
              )}
            </div>
          ) : showDisputeForm ? (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#FF1493', marginBottom: 4 }}>
                Report an Issue
              </h3>
              <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
                Something wrong with your order? Let us know and we will review it.
              </p>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#555', marginBottom: 6 }}>Reason</div>
                <select
                  value={disputeReason}
                  onChange={e => setDisputeReason(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: '1px solid #FFB6C1', fontSize: 14, outline: 'none',
                    fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box',
                  }}
                >
                  <option value="">Select a reason...</option>
                  <option value="wrong_items">Wrong Items</option>
                  <option value="missing_items">Missing Items</option>
                  <option value="cold_food">Cold Food</option>
                  <option value="late_delivery">Late Delivery</option>
                  <option value="never_delivered">Never Delivered</option>
                  <option value="damaged">Damaged</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#555', marginBottom: 6 }}>Description (optional)</div>
                <textarea
                  value={disputeDescription}
                  onChange={e => setDisputeDescription(e.target.value)}
                  placeholder="Describe the issue..."
                  maxLength={1000}
                  style={{
                    width: '100%', minHeight: 80, borderRadius: 8,
                    border: '1px solid #FFB6C1', padding: '10px 12px',
                    fontSize: 14, resize: 'vertical', outline: 'none',
                    fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#FF1493' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#FFB6C1' }}
                />
              </div>

              <div style={{ marginBottom: 16, display: 'none' }}>
                <input type="hidden" value={disputeAmount} />
              </div>

              {/* Photo Upload */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#555', marginBottom: 6 }}>Photos (optional)</div>
                <p style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>Upload photos or a short video clip (max 30s) to help us review your report.</p>

                {disputePhotos.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    {disputePhotos.map((url, i) => {
                      const isVideo = url.match(/\.(mp4|mov|webm)(\?|$)/i)
                      return (
                        <div key={i} style={{ position: 'relative', width: 80, height: 80 }}>
                          {isVideo ? (
                            <video src={url} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid #ddd' }} muted />
                          ) : (
                            <img src={url} alt={`Issue ${i + 1}`} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid #ddd' }} />
                          )}
                          <button
                            onClick={() => setDisputePhotos(prev => prev.filter((_, idx) => idx !== i))}
                            style={{
                              position: 'absolute', top: -6, right: -6, background: '#DC2626', color: '#fff',
                              border: 'none', borderRadius: '50%', width: 20, height: 20, fontSize: 12,
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >x</button>
                          {isVideo && <div style={{ position: 'absolute', bottom: 4, left: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>VIDEO</div>}
                        </div>
                      )
                    })}
                  </div>
                )}

                <input
                  type="file"
                  accept="image/*,video/mp4,video/quicktime,video/webm"
                  multiple
                  disabled={disputeUploading}
                  onChange={async (e) => {
                    const files = e.target.files
                    if (!files || files.length === 0) return
                    setDisputeUploading(true)
                    for (let i = 0; i < Math.min(files.length, 3 - disputePhotos.length); i++) {
                      try {
                        const formData = new FormData()
                        formData.append('file', files[i])
                        const res = await fetch('/api/dispute-upload', { method: 'POST', body: formData })
                        if (res.ok) {
                          const data = await res.json()
                          setDisputePhotos(prev => [...prev, data.url])
                        } else {
                          const err = await res.json()
                          alert(err.error || 'Upload failed')
                        }
                      } catch {}
                    }
                    setDisputeUploading(false)
                    e.target.value = ''
                  }}
                  style={{ display: 'none' }}
                  id="dispute-photo-input"
                />
                {disputePhotos.length < 3 && (
                  <button
                    type="button"
                    onClick={() => document.getElementById('dispute-photo-input')?.click()}
                    disabled={disputeUploading}
                    style={{
                      padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      background: disputeUploading ? '#ccc' : '#FFF0F5', color: '#FF1493',
                      border: '1px solid #FFB6C1', cursor: disputeUploading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {disputeUploading ? 'Uploading...' : `Upload Photo/Video${disputePhotos.length > 0 ? ` (${disputePhotos.length}/3)` : ''}`}
                  </button>
                )}
              </div>

              {disputeError && (
                <div style={{
                  background: '#FFF0F5', color: '#FF1493', borderRadius: 8,
                  padding: '8px 12px', fontSize: 13, marginBottom: 12,
                  border: '1px solid #FFB6C1',
                }}>
                  {disputeError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setShowDisputeForm(false)}
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: 10,
                    background: '#f5f5f5', color: '#666', fontWeight: 700, fontSize: 15,
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={submitDispute}
                  disabled={disputeSubmitting || !disputeReason}
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: 10,
                    background: disputeReason ? '#FF1493' : '#FFB6C1',
                    color: '#fff', fontWeight: 700, fontSize: 15,
                    border: 'none', cursor: disputeReason ? 'pointer' : 'not-allowed',
                    opacity: disputeSubmitting ? 0.7 : 1,
                  }}
                >
                  {disputeSubmitting ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <button
                onClick={() => setShowDisputeForm(true)}
                style={{
                  padding: '10px 24px', borderRadius: 10,
                  background: 'none', color: '#FF1493', fontWeight: 700, fontSize: 14,
                  border: '1px solid #FFB6C1', cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#FFF0F5' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
              >
                Report an Issue
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
