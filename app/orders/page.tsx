'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import OrderStatusBadge from '@/components/OrderStatusBadge'
import { useAuth } from '@/lib/auth-context'
import type { Order } from '@/lib/types'

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoading(false)
      return
    }

    fetch('/api/orders')
      .then(res => res.json())
      .then(data => setOrders(data.orders || []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false))
  }, [user, authLoading])

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
                <Link key={order.id} href={`/orders/${order.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{
                    background: 'white', borderRadius: '14px', border: '1px solid #f0f0f0',
                    padding: '1.25rem', transition: 'all 0.2s', cursor: 'pointer',
                  }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = '#FF69B4'
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(255, 20, 147, 0.1)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#f0f0f0'
                      e.currentTarget.style.boxShadow = 'none'
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
                          {new Date(order.created_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
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
                      <span style={{ fontWeight: 700, color: '#FF1493' }}>
                        ${order.total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </Link>
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
