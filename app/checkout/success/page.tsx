'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { useCart } from '@/lib/cart-context'

export default function CheckoutSuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  )
}

function SuccessContent() {
  const searchParams = useSearchParams()
  const orderIdParam = searchParams.get('order_id') || ''
  const sessionId = searchParams.get('session_id') || ''
  const isStripe = searchParams.get('stripe') === '1'
  const [orderId, setOrderId] = useState(orderIdParam)
  const { clearCart } = useCart()

  useEffect(() => {
    clearCart()
  }, [clearCart])

  // For Stripe payments, look up the order by session_id (order created via webhook)
  useEffect(() => {
    if (!isStripe || !sessionId || orderId) return
    let attempts = 0
    const maxAttempts = 10
    const poll = async () => {
      try {
        const res = await fetch(`/api/stripe/order-lookup?session_id=${sessionId}`)
        const data = await res.json()
        if (data.order_id) {
          setOrderId(data.order_id)
          return
        }
      } catch { /* ignore */ }
      attempts++
      if (attempts < maxAttempts) {
        setTimeout(poll, 2000)
      }
    }
    poll()
  }, [isStripe, sessionId, orderId])

  // Confirm the order and trigger driver auto-assignment
  useEffect(() => {
    if (!orderId) return
    fetch('/api/checkout/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId }),
    }).catch(() => {})
  }, [orderId])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '500px' }}>
          <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>🎉</div>

          <h1 style={{
            fontSize: '2rem', fontWeight: 800, color: '#1A1A2E', marginBottom: '0.75rem',
          }}>
            Order Placed!
          </h1>

          <p style={{ color: '#666', fontSize: '1.05rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            Your order has been sent to the shop. Once they accept it, we&apos;ll find a driver and you can track your delivery live.
          </p>

          {orderId && (
            <div style={{
              background: '#FFF0F5', borderRadius: '12px', padding: '1rem',
              marginBottom: '2rem', display: 'inline-block',
            }}>
              <span style={{ color: '#888', fontSize: '0.85rem' }}>Order ID</span>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#FF1493', fontFamily: 'monospace' }}>
                {orderId.slice(0, 8).toUpperCase()}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {orderId && (
              <Link href={`/orders/${orderId}`} style={{
                background: '#FF1493', color: 'white', padding: '0.85rem 2rem',
                borderRadius: '10px', fontWeight: 700, fontSize: '0.95rem',
                textDecoration: 'none',
              }}>
                Track Order
              </Link>
            )}
            <Link href="/shops" style={{
              background: 'white', color: '#FF1493', padding: '0.85rem 2rem',
              borderRadius: '10px', fontWeight: 700, fontSize: '0.95rem',
              border: '2px solid #FF1493', textDecoration: 'none',
            }}>
              Continue Browsing
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
