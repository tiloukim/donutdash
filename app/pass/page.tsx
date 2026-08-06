'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function PassPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [subscribed, setSubscribed] = useState(false)
  const [subStatus, setSubStatus] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!user) { setLoading(false); return }
    fetch('/api/subscription')
      .then(r => r.json())
      .then(data => {
        setSubscribed(data.subscribed)
        setSubStatus(data.status || '')
        setExpiresAt(data.expires_at || '')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user, authLoading])

  const handleSubscribe = async () => {
    if (!user) { router.push('/login'); return }
    setActing(true)
    setMessage('')
    const res = await fetch('/api/subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'subscribe' }),
    })
    const data = await res.json()
    if (res.ok) {
      setSubscribed(true)
      setSubStatus('active')
      setExpiresAt(data.expires_at || '')
      setMessage('Welcome to DonutDash Pass!')
    } else {
      setMessage(data.error || 'Something went wrong')
    }
    setActing(false)
  }

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel your DonutDash Pass?')) return
    setActing(true)
    setMessage('')
    const res = await fetch('/api/subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    })
    if (res.ok) {
      setSubscribed(false)
      setSubStatus('cancelled')
      setMessage('Your subscription has been cancelled.')
    } else {
      const data = await res.json()
      setMessage(data.error || 'Something went wrong')
    }
    setActing(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 50%, #0F3460 100%)' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          <img src="/logo.png" alt="DonutDash" style={{ height: 40 }} />
        </Link>
        <Link href="/" style={{ color: '#fff', fontWeight: 600, textDecoration: 'none', fontSize: 14, opacity: 0.8 }}>Back</Link>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 16px', textAlign: 'center' }}>
        {/* Badge */}
        <div style={{
          display: 'inline-block',
          background: 'linear-gradient(135deg, #FF1493, #FF69B4)',
          borderRadius: 50,
          padding: '6px 20px',
          fontSize: 13,
          fontWeight: 700,
          color: '#fff',
          letterSpacing: 1,
          marginBottom: 24,
          textTransform: 'uppercase',
        }}>
          Premium
        </div>

        {/* Title */}
        <h1 style={{ fontSize: 36, fontWeight: 800, color: '#fff', margin: '0 0 8px 0', lineHeight: 1.2 }}>
          DonutDash™ Pass
        </h1>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', margin: '0 0 40px 0' }}>
          Unlock the best delivery experience
        </p>

        {/* Benefits Card */}
        <div style={{
          background: 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(10px)',
          borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.12)',
          padding: '32px 24px',
          marginBottom: 32,
          textAlign: 'left',
        }}>
          {[
            { icon: '🚚', title: 'Free Delivery', desc: 'On every order, no minimum' },
            { icon: '💰', title: 'Reduced Service Fees', desc: 'Save more on every order' },
            { icon: '⚡', title: 'Priority Orders', desc: 'Your orders get prepared first' },
          ].map((b, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 16,
              padding: '14px 0',
              borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.08)' : 'none',
            }}>
              <span style={{ fontSize: 28 }}>{b.icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>{b.title}</div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{b.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Price */}
        <div style={{ marginBottom: 24 }}>
          <span style={{ fontSize: 42, fontWeight: 800, color: '#fff' }}>$9.99</span>
          <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)' }}>/month</span>
        </div>

        {/* Message */}
        {message && (
          <div style={{
            padding: '10px 16px',
            borderRadius: 10,
            marginBottom: 16,
            fontSize: 14,
            fontWeight: 600,
            background: subscribed ? 'rgba(16,185,129,0.2)' : 'rgba(255,20,147,0.2)',
            color: subscribed ? '#6EE7B7' : '#FF69B4',
          }}>
            {message}
          </div>
        )}

        {/* CTA */}
        {loading || authLoading ? (
          <div style={{ color: 'rgba(255,255,255,0.5)', padding: 20 }}>Loading...</div>
        ) : subscribed ? (
          <div>
            <div style={{
              background: 'rgba(16,185,129,0.15)',
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 14,
              padding: '20px 24px',
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#6EE7B7', marginBottom: 4 }}>
                Active Member
              </div>
              {expiresAt && (
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                  Renews {new Date(expiresAt).toLocaleDateString()}
                </div>
              )}
            </div>
            <button onClick={handleCancel} disabled={acting} style={{
              padding: '12px 32px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'transparent',
              color: 'rgba(255,255,255,0.6)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}>
              {acting ? 'Cancelling...' : 'Cancel Subscription'}
            </button>
          </div>
        ) : (
          <button onClick={handleSubscribe} disabled={acting} style={{
            width: '100%',
            padding: '16px',
            borderRadius: 14,
            border: 'none',
            background: 'linear-gradient(135deg, #FF1493, #FF69B4)',
            color: '#fff',
            fontSize: 17,
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(255,20,147,0.4)',
          }}>
            {acting ? 'Activating...' : 'Start Free Trial'}
          </button>
        )}

        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 16 }}>
          30-day free trial. Cancel anytime.
        </p>
      </div>
    </div>
  )
}
