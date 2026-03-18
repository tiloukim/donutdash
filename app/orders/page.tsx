'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import OrderStatusBadge from '@/components/OrderStatusBadge'
import { useAuth } from '@/lib/auth-context'
import type { Order } from '@/lib/types'

function OrderCard({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false)

  const formattedDate = new Date(order.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div style={{
      background: 'white', borderRadius: '14px', border: '1px solid #f0f0f0',
      overflow: 'hidden', transition: 'all 0.2s',
    }}>
      {/* Collapsed header - always visible */}
      <div
        style={{
          padding: '1.25rem', cursor: 'pointer', transition: 'all 0.2s',
        }}
        onClick={() => setExpanded(prev => !prev)}
        onMouseEnter={e => {
          e.currentTarget.style.background = '#FFF5FA'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'white'
        }}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem',
        }}>
          <div>
            <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>
              {order.shop?.name || 'Order'}
            </h3>
            <p style={{ color: '#888', fontSize: '0.8rem' }}>
              {formattedDate}
            </p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: '0.9rem',
        }}>
          <span style={{ color: '#888' }}>
            {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontWeight: 700, color: '#FF1493' }}>
              ${Number(order.total).toFixed(2)}
            </span>
            <span style={{
              display: 'inline-block', transition: 'transform 0.2s',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              fontSize: '0.75rem', color: '#aaa',
            }}>
              ▼
            </span>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{
          borderTop: '1px solid #f0f0f0', padding: '1.25rem',
          background: '#FEFAFC',
        }}>
          {/* Items list */}
          {order.items && order.items.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1A1A2E', marginBottom: '0.5rem' }}>
                Items Ordered
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {order.items.map((item: any, idx: number) => (
                  <div key={idx} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    fontSize: '0.85rem', padding: '0.4rem 0',
                    borderBottom: idx < (order.items?.length || 0) - 1 ? '1px solid #f5f0f2' : 'none',
                  }}>
                    <span style={{ color: '#333' }}>
                      <span style={{
                        display: 'inline-block', background: '#FF149315', color: '#FF1493',
                        borderRadius: '6px', padding: '0.1rem 0.4rem', fontSize: '0.75rem',
                        fontWeight: 600, marginRight: '0.5rem',
                      }}>
                        x{item.quantity}
                      </span>
                      {item.name}
                    </span>
                    <span style={{ color: '#555', fontWeight: 500 }}>
                      ${(Number(item.price) * Number(item.quantity)).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cost breakdown */}
          <div style={{
            background: 'white', borderRadius: '10px', padding: '0.75rem 1rem',
            border: '1px solid #f0f0f0', marginBottom: '1rem',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666' }}>
                <span>Subtotal</span>
                <span>${Number(order.subtotal || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666' }}>
                <span>Delivery Fee</span>
                <span>${Number(order.delivery_fee || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666' }}>
                <span>Service Fee</span>
                <span>${Number(order.service_fee || 0).toFixed(2)}</span>
              </div>
              {Number(order.tip || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666' }}>
                  <span>Tip</span>
                  <span>${Number(order.tip).toFixed(2)}</span>
                </div>
              )}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                borderTop: '1px solid #eee', paddingTop: '0.4rem', marginTop: '0.2rem',
                fontWeight: 700, color: '#1A1A2E', fontSize: '0.95rem',
              }}>
                <span>Total</span>
                <span style={{ color: '#FF1493' }}>${Number(order.total).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Delivery address */}
          {order.delivery_address && (
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1A1A2E', marginBottom: '0.25rem' }}>
                Delivery Address
              </h4>
              <p style={{ fontSize: '0.85rem', color: '#666', lineHeight: 1.4 }}>
                {order.delivery_address}
              </p>
            </div>
          )}

          {/* Track order link */}
          <Link href={`/orders/${order.id}`} style={{
            display: 'block', textAlign: 'center', background: '#FF1493', color: 'white',
            padding: '0.6rem 1.5rem', borderRadius: '10px', fontWeight: 600,
            fontSize: '0.9rem', textDecoration: 'none', transition: 'background 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = '#E0117F' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#FF1493' }}
          >
            Track Order
          </Link>
        </div>
      )}
    </div>
  )
}

const STATUS_MESSAGES: Record<string, string> = {
  confirmed: 'Your order has been confirmed by the shop!',
  preparing: 'Your order is being prepared!',
  ready_for_pickup: 'Your order is ready for pickup!',
  picked_up: 'A driver has picked up your order!',
  delivering: 'Your order is on the way!',
  delivered: 'Your order has been delivered!',
}

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const prevStatusesRef = useRef<Record<string, string>>({})

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoading(false)
      return
    }

    fetch('/api/orders')
      .then(res => res.json())
      .then(data => {
        const list = data.orders || []
        // Store initial statuses
        const statuses: Record<string, string> = {}
        list.forEach((o: Order) => { statuses[o.id] = o.status })
        prevStatusesRef.current = statuses
        setOrders(list)
      })
      .catch(() => setOrders([]))
      .finally(() => setLoading(false))
  }, [user, authLoading])

  // Poll for status updates on active orders
  useEffect(() => {
    if (!user || orders.length === 0) return
    const hasActive = orders.some(o => !['delivered', 'cancelled'].includes(o.status))
    if (!hasActive) return

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    const poll = () => {
      fetch('/api/orders')
        .then(res => res.json())
        .then(data => {
          const list = data.orders || []
          // Check for status changes
          list.forEach((o: Order) => {
            const prev = prevStatusesRef.current[o.id]
            if (prev && prev !== o.status && STATUS_MESSAGES[o.status]) {
              // Browser notification
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('DonutDash Order Update', {
                  body: STATUS_MESSAGES[o.status],
                  icon: '/logo.png',
                  tag: `order-${o.id}-${o.status}`,
                })
              }
            }
            prevStatusesRef.current[o.id] = o.status
          })
          setOrders(list)
        })
        .catch(() => {})
    }

    const interval = setInterval(poll, 8000)
    return () => clearInterval(interval)
  }, [user, orders.length])

  if (!authLoading && !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1rem' }}>🔒</span>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Sign in to view orders</h1>
            <p style={{ color: '#888', marginBottom: '2rem' }}>You need to be signed in to view your order history.</p>
            <Link href="/login" style={{
              background: '#FF1493', color: 'white', padding: '0.75rem 2rem',
              borderRadius: '10px', fontWeight: 600, display: 'inline-block',
            }}>
              Sign In
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1, padding: '2rem 1.5rem' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1A1A2E', marginBottom: '2rem' }}>
            My Orders
          </h1>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{
                  background: '#f5f5f5', borderRadius: '14px', height: '120px',
                }} />
              ))}
            </div>
          ) : orders.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {orders.map(order => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#888' }}>
              <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1rem' }}>📋</span>
              <h2 style={{ fontWeight: 600, fontSize: '1.3rem', marginBottom: '0.5rem', color: '#1A1A2E' }}>
                No orders yet
              </h2>
              <p style={{ marginBottom: '2rem' }}>Place your first order and it will show up here.</p>
              <Link href="/shops" style={{
                background: '#FF1493', color: 'white', padding: '0.75rem 2rem',
                borderRadius: '10px', fontWeight: 600, display: 'inline-block',
              }}>
                Browse Shops
              </Link>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
