'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'

export default function ForgotPasswordPage() {
  const { supabase } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      }),
    })
    const result = await res.json()

    if (!res.ok) {
      setError(result.error || 'Failed to send reset email')
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #FFF0F5 0%, #FFF5EE 100%)', padding: '20px',
    }}>
      <div style={{
        background: 'white', borderRadius: '16px', padding: '2.5rem',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)', maxWidth: '420px', width: '100%',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <Link href="/">
            <img src="/logo.png" alt="DonutDash" style={{ height: '60px', width: 'auto' }} />
          </Link>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1A1A2E', margin: '1rem 0 0.25rem' }}>
            Reset Password
          </h1>
          <p style={{ color: '#888', fontSize: '0.85rem' }}>
            Enter your email and we'll send you a reset link
          </p>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📧</div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1A1A2E', marginBottom: '0.5rem' }}>
              Check your email
            </h2>
            <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              We sent a password reset link to <strong>{email}</strong>
            </p>
            <Link href="/login" style={{
              display: 'inline-block', padding: '0.7rem 2rem', background: '#FF1493',
              color: 'white', borderRadius: '10px', fontWeight: 600, textDecoration: 'none',
              fontSize: '0.9rem',
            }}>
              Back to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {error && (
              <div style={{
                background: '#FFF0F0', color: '#D32F2F', padding: '0.75rem',
                borderRadius: '8px', fontSize: '0.85rem', textAlign: 'center',
              }}>
                {error}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: '0.35rem', color: '#1A1A2E' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                style={{
                  width: '100%', padding: '0.75rem 1rem', borderRadius: '10px',
                  border: '1px solid #ddd', fontSize: '0.95rem', outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')}
                onBlur={e => (e.currentTarget.style.borderColor = '#ddd')}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '0.85rem',
                background: loading ? '#ccc' : '#FF1493',
                color: 'white', border: 'none', borderRadius: '10px',
                fontSize: '1rem', fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>

            <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#888', marginTop: '0.5rem' }}>
              Remember your password?{' '}
              <Link href="/login" style={{ color: '#FF1493', fontWeight: 600, textDecoration: 'none' }}>
                Sign In
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
