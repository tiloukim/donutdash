'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import Turnstile from '@/components/Turnstile'

interface RoleAuthFormProps {
  role: 'driver' | 'shop_owner' | 'admin'
  roleLabel: string
  accentColor: string
  accentHover: string
  bgGradient: string
  icon: string
  tagline: string
  redirectTo: string
}

export default function RoleAuthForm({
  role,
  roleLabel,
  accentColor,
  accentHover,
  bgGradient,
  icon,
  tagline,
  redirectTo,
}: RoleAuthFormProps) {
  const { supabase, refreshUser } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [smsConsent, setSmsConsent] = useState(false)
  const [showConfirmEmail, setShowConfirmEmail] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (!captchaToken) {
        setError('Please complete the CAPTCHA verification.')
        setLoading(false)
        return
      }
      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: { captchaToken },
        })
        if (signInError) {
          setError(signInError.message)
          return
        }
        await refreshUser()
        // Page will re-render with auth, layout will show dashboard
      } else {
        if (password.length < 6) {
          setError('Password must be at least 6 characters.')
          return
        }
        if (!smsConsent) {
          setError('You must agree to receive SMS notifications to create an account.')
          return
        }
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
              phone: phone || null,
              role,
            },
            captchaToken,
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })
        if (signUpError) {
          setError(signUpError.message)
          return
        }
        // If email confirmation is required, session will be null
        if (data.user && !data.session) {
          setShowConfirmEmail(true)
          return
        }
        if (data.user) {
          await refreshUser()
          if (role === 'shop_owner') {
            window.location.href = '/partner-setup'
          }
        }
      }
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: '10px',
    border: '1px solid #ddd',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  }

  if (showConfirmEmail) {
    return (
      <div style={{
        minHeight: '100vh',
        background: bgGradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}>
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '2.5rem',
          maxWidth: '420px',
          width: '100%',
          boxShadow: '0 8px 40px rgba(0, 0, 0, 0.08)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#x2709;&#xFE0F;</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1A1A2E', marginBottom: 12 }}>
            Check Your Email
          </h1>
          <p style={{ color: '#666', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: 24 }}>
            We sent a confirmation link to <strong>{email}</strong>. Please click the link in your email to verify your account before signing in.
          </p>
          <p style={{ color: '#999', fontSize: '0.85rem', marginBottom: 24 }}>
            Didn&apos;t receive it? Check your spam folder or try signing up again.
          </p>
          <button
            onClick={() => { setShowConfirmEmail(false); setMode('login'); setError('') }}
            style={{
              width: '100%',
              padding: '0.85rem',
              background: accentColor,
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Go to Sign In
          </button>
          <div style={{ marginTop: '1rem' }}>
            <Link href="/" style={{ color: '#aaa', fontSize: '0.8rem', textDecoration: 'none' }}>
              &larr; Back to DonutDash
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: bgGradient,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '2.5rem',
        maxWidth: '420px',
        width: '100%',
        boxShadow: `0 8px 40px rgba(0, 0, 0, 0.08)`,
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>{icon}</div>
          <Link href="/" style={{ display: 'inline-block', textDecoration: 'none' }}>
            <img src="/logo.png" alt="DonutDash" style={{ height: '50px', width: 'auto' }} />
          </Link>
          <div style={{
            display: 'inline-block',
            background: accentColor,
            color: '#fff',
            fontSize: '11px',
            fontWeight: 800,
            padding: '3px 10px',
            borderRadius: '4px',
            marginLeft: '8px',
            verticalAlign: 'middle',
            letterSpacing: '0.5px',
          }}>
            {roleLabel.toUpperCase()}
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1A1A2E', marginTop: '1rem' }}>
            {mode === 'login' ? `${roleLabel} Sign In` : `Create ${roleLabel} Account`}
          </h1>
          <p style={{ color: '#888', fontSize: '0.9rem', marginTop: '0.35rem' }}>
            {tagline}
          </p>
        </div>

        {error && (
          <div style={{
            background: '#F8D7DA',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            fontSize: '0.85rem',
            color: '#721C24',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {mode === 'signup' && (
            <>
              <div>
                <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: '0.35rem', color: '#1A1A2E' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  placeholder="John Doe"
                  style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = accentColor)}
                  onBlur={e => (e.currentTarget.style.borderColor = '#ddd')}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: '0.35rem', color: '#1A1A2E' }}>
                  Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = accentColor)}
                  onBlur={e => (e.currentTarget.style.borderColor = '#ddd')}
                />
              </div>
            </>
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
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = accentColor)}
              onBlur={e => (e.currentTarget.style.borderColor = '#ddd')}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: '0.35rem', color: '#1A1A2E' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = accentColor)}
              onBlur={e => (e.currentTarget.style.borderColor = '#ddd')}
            />
          </div>

          {mode === 'signup' && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <input
                type="checkbox"
                id="sms-consent-role"
                checked={smsConsent}
                onChange={e => setSmsConsent(e.target.checked)}
                style={{ marginTop: '3px', accentColor: accentColor, width: '16px', height: '16px', flexShrink: 0 }}
              />
              <label htmlFor="sms-consent-role" style={{ fontSize: '0.8rem', color: '#555', lineHeight: 1.5 }}>
                I agree to receive SMS notifications about my orders, delivery updates, and account alerts.
                Message &amp; data rates may apply. Reply STOP to unsubscribe.{' '}
                <Link href="/privacy" style={{ color: accentColor, textDecoration: 'underline' }}>
                  Privacy Policy
                </Link>
              </label>
            </div>
          )}

          <Turnstile onToken={setCaptchaToken} />

          <button
            type="submit"
            disabled={loading || !captchaToken || (mode === 'signup' && !smsConsent)}
            style={{
              width: '100%',
              padding: '0.85rem',
              background: (loading || !captchaToken || (mode === 'signup' && !smsConsent)) ? '#ccc' : accentColor,
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
              marginTop: '0.5rem',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = accentHover }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = accentColor }}
          >
            {loading
              ? (mode === 'login' ? 'Signing in...' : 'Creating account...')
              : (mode === 'login' ? 'Sign In' : 'Create Account')
            }
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem', color: '#666' }}>
          {mode === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <button
                onClick={() => { setMode('signup'); setError('') }}
                style={{ color: accentColor, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
              >
                Sign Up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                onClick={() => { setMode('login'); setError('') }}
                style={{ color: accentColor, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
              >
                Sign In
              </button>
            </>
          )}
        </p>

        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <Link href="/" style={{ color: '#aaa', fontSize: '0.8rem', textDecoration: 'none' }}>
            ← Back to DonutDash
          </Link>
        </div>
      </div>
    </div>
  )
}
