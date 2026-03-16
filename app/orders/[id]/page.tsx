'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import OrderStatusBadge from '@/components/OrderStatusBadge'
import { ORDER_STATUS_LABELS } from '@/lib/constants'
import type { Order } from '@/lib/types'

const PROGRESS_STEPS = [
  'pending',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'picked_up',
  'delivering',
  'delivered',
]

export default function OrderDetailPage() {
  const params = useParams()
  const orderId = params.id as string
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchOrder = () => {
    fetch(`/api/orders/${orderId}`)
      .then(res => {
        if (!res.ok) throw new Error('Order not found')
        return res.json()
      })
      .then(data => setOrder(data.order))
      .catch(() => setError('Order not found'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!orderId) return
    fetchOrder()
  }, [orderId])

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!orderId || error) return
    const interval = setInterval(() => {
      fetch(`/api/orders/${orderId}`)
        .then(res => res.json())
        .then(data => { if (data.order) setOrder(data.order) })
        .catch(() => {})
    }, 10000)
    return () => clearInterval(interval)
  }, [orderId, error])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <Navbar />
        <div style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem 1.5rem' }}>
          <div style={{ height: '24px', width: '200px', background: '#f5f5f5', borderRadius: '6px', marginBottom: '2rem' }} />
          <div style={{ height: '100px', background: '#f5f5f5', borderRadius: '14px', marginBottom: '1rem' }} />
          <div style={{ height: '200px', background: '#f5f5f5', borderRadius: '14px' }} />
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <Navbar />
        <div style={{ textAlign: 'center', padding: '6rem 1rem' }}>
          <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1rem' }}>😕</span>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Order not found</h1>
          <p style={{ color: '#888', marginBottom: '2rem' }}>The order you are looking for does not exist.</p>
          <Link href="/orders" style={{
            background: '#FF1493', color: 'white', padding: '0.75rem 2rem',
            borderRadius: '10px', fontWeight: 600, display: 'inline-block',
          }}>
            My Orders
          </Link>
        </div>
      </div>
    )
  }

  const currentStepIndex = PROGRESS_STEPS.indexOf(order.status)
  const isCancelled = order.status === 'cancelled'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1, padding: '2rem 1.5rem' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '2rem', flexWrap: 'wrap', gap: '0.5rem',
          }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1A1A2E' }}>
                Order #{order.id.slice(0, 8).toUpperCase()}
              </h1>
              <p style={{ color: '#888', fontSize: '0.85rem' }}>
                {new Date(order.created_at).toLocaleDateString('en-US', {
                  month: 'long', day: 'numeric', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>

          {/* Progress Bar */}
          {!isCancelled && (
            <div style={{
              background: 'white', borderRadius: '14px', border: '1px solid #f0f0f0',
              padding: '1.5rem', marginBottom: '1.5rem',
            }}>
              <h3 style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '1.25rem', color: '#1A1A2E' }}>
                Order Progress
              </h3>
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between' }}>
                {/* Background line */}
                <div style={{
                  position: 'absolute', top: '12px', left: '12px', right: '12px',
                  height: '3px', background: '#f0f0f0', zIndex: 0,
                }} />
                {/* Active line */}
                <div style={{
                  position: 'absolute', top: '12px', left: '12px',
                  width: `${Math.max(0, currentStepIndex / (PROGRESS_STEPS.length - 1)) * (100 - (24 / 7))}%`,
                  height: '3px', background: '#FF1493', zIndex: 1,
                  transition: 'width 0.5s ease',
                }} />

                {PROGRESS_STEPS.map((step, i) => {
                  const isActive = i <= currentStepIndex
                  const isCurrent = i === currentStepIndex
                  return (
                    <div key={step} style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      position: 'relative', zIndex: 2, flex: 1,
                    }}>
                      <div style={{
                        width: '26px', height: '26px', borderRadius: '50%',
                        background: isActive ? '#FF1493' : 'white',
                        border: isActive ? 'none' : '2px solid #ddd',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: isCurrent ? '0 0 0 4px rgba(255, 20, 147, 0.2)' : 'none',
                        transition: 'all 0.3s',
                      }}>
                        {isActive && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                          </svg>
                        )}
                      </div>
                      <span style={{
                        fontSize: '0.65rem', color: isActive ? '#FF1493' : '#888',
                        fontWeight: isActive ? 600 : 400,
                        textAlign: 'center', marginTop: '0.4rem',
                        maxWidth: '60px', lineHeight: 1.2,
                      }}>
                        {ORDER_STATUS_LABELS[step]}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {isCancelled && (
            <div style={{
              background: '#F8D7DA', borderRadius: '14px', padding: '1.25rem',
              marginBottom: '1.5rem', textAlign: 'center',
            }}>
              <p style={{ color: '#721C24', fontWeight: 600 }}>This order has been cancelled.</p>
            </div>
          )}

          {/* Order Items */}
          <div style={{
            background: 'white', borderRadius: '14px', border: '1px solid #f0f0f0',
            padding: '1.5rem', marginBottom: '1.5rem',
          }}>
            <h3 style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '1rem', color: '#1A1A2E' }}>
              Order Items
              {order.shop && (
                <span style={{ fontWeight: 400, color: '#888', fontSize: '0.9rem', marginLeft: '0.5rem' }}>
                  from {order.shop.name}
                </span>
              )}
            </h3>

            {order.items?.map(item => (
              <div key={item.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.6rem 0', borderBottom: '1px solid #f8f8f8',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '8px', flexShrink: 0,
                    background: item.image_url
                      ? `url(${item.image_url}) center/cover no-repeat`
                      : 'linear-gradient(135deg, #FFF0F5, #FFE4E1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {!item.image_url && <span style={{ fontSize: '1rem' }}>🍩</span>}
                  </div>
                  <div>
                    <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{item.name}</span>
                    <span style={{ color: '#888', fontSize: '0.8rem', marginLeft: '0.5rem' }}>x{item.quantity}</span>
                  </div>
                </div>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}

            <div style={{ borderTop: '1px solid #f0f0f0', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                <span style={{ color: '#666' }}>Subtotal</span>
                <span>${order.subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                <span style={{ color: '#666' }}>Delivery Fee</span>
                <span>${order.delivery_fee.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                <span style={{ color: '#666' }}>Service Fee</span>
                <span>${order.service_fee.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                <span style={{ color: '#666' }}>Tip</span>
                <span>${order.tip.toFixed(2)}</span>
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                borderTop: '1px solid #f0f0f0', paddingTop: '0.6rem', marginTop: '0.4rem',
              }}>
                <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>Total</span>
                <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#FF1493' }}>
                  ${order.total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Delivery Address */}
          <div style={{
            background: 'white', borderRadius: '14px', border: '1px solid #f0f0f0',
            padding: '1.5rem', marginBottom: '1.5rem',
          }}>
            <h3 style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.75rem', color: '#1A1A2E' }}>
              Delivery Address
            </h3>
            <p style={{ color: '#666', fontSize: '0.9rem' }}>{order.delivery_address}</p>
            {order.delivery_city && (
              <p style={{ color: '#666', fontSize: '0.9rem' }}>{order.delivery_city}</p>
            )}
            {order.delivery_instructions && (
              <p style={{ color: '#888', fontSize: '0.85rem', marginTop: '0.5rem', fontStyle: 'italic' }}>
                Note: {order.delivery_instructions}
              </p>
            )}
          </div>

          <div style={{ textAlign: 'center' }}>
            <Link href="/orders" style={{
              color: '#FF1493', fontWeight: 600, fontSize: '0.95rem',
            }}>
              &larr; Back to Orders
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
