'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

function PayPalSuccessInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderId = searchParams.get('order_id')
  const paypalToken = searchParams.get('token') // PayPal adds this
  const [status, setStatus] = useState<'capturing' | 'success' | 'error'>('capturing')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!orderId || !paypalToken) {
      setStatus('error')
      setError('Missing order information')
      return
    }

    // Capture the PayPal payment
    fetch('/api/paypal/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paypalOrderId: paypalToken, orderId }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStatus('success')
          // Redirect to the regular success page after a moment
          setTimeout(() => router.push(`/checkout/success?order_id=${orderId}`), 2000)
        } else {
          setStatus('error')
          setError(data.error || 'Payment capture failed')
        }
      })
      .catch(() => {
        setStatus('error')
        setError('Something went wrong processing your payment')
      })
  }, [orderId, paypalToken, router])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#FAFAFA', padding: '2rem',
    }}>
      <div style={{
        background: 'white', borderRadius: 20, padding: '3rem', maxWidth: 420, width: '100%',
        textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        {status === 'capturing' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A1A2E', marginBottom: 8 }}>
              Processing Payment...
            </h1>
            <p style={{ color: '#888', fontSize: 14 }}>
              Please wait while we confirm your PayPal payment.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A1A2E', marginBottom: 8 }}>
              Payment Successful!
            </h1>
            <p style={{ color: '#888', fontSize: 14 }}>
              Redirecting to your order...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A1A2E', marginBottom: 8 }}>
              Payment Failed
            </h1>
            <p style={{ color: '#DC2626', fontSize: 14, marginBottom: 16 }}>{error}</p>
            <Link href="/cart" style={{
              display: 'inline-block', padding: '12px 24px', background: '#FF1493',
              color: 'white', borderRadius: 10, fontWeight: 700, textDecoration: 'none',
            }}>
              Back to Cart
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

export default function PayPalSuccessPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>}>
      <PayPalSuccessInner />
    </Suspense>
  )
}
