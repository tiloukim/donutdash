'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { isAnyManager } from '@/lib/admin-auth'
import Turnstile from '@/components/Turnstile'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const claimShopId = searchParams.get('claim')
  const isApp = searchParams.get('app') === '1' || (typeof window !== 'undefined' && !!(window as unknown as Record<string, unknown>).ReactNativeWebView)
  const { supabase, refreshUser } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [captchaToken, setCaptchaToken] = useState(isApp ? 'app-bypass' : '')
  const [claimMessage, setClaimMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (!isApp && !captchaToken) {
        setError('Please complete the CAPTCHA verification.')
        setLoading(false)
        return
      }

      let signInError: { message: string } | null = null

      if (isApp) {
        // Use server-side API to bypass captcha for mobile app
        const res = await fetch('/api/auth/app-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
        const result = await res.json()
        if (!res.ok) {
          signInError = { message: result.error || 'Login failed' }
        } else if (result.session) {
          // Set the session in the client
          await supabase.auth.setSession({
            access_token: result.session.access_token,
            refresh_token: result.session.refresh_token,
          })
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: { captchaToken },
        })
        signInError = error
      }

      if (signInError) {
        setError(signInError.message)
        return
      }

      await refreshUser()

      // If claiming a shop, attempt it now.
      if (claimShopId) {
        try {
          const claimRes = await fetch('/api/shop/claim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shop_id: claimShopId }),
          })
          if (claimRes.ok) {
            setClaimMessage('Shop claimed! Redirecting to your dashboard...')
            setTimeout(() => router.push('/shop'), 800)
            return
          } else {
            const errData = await claimRes.json().catch(() => ({}))
            setError(errData.error || 'Signed in, but we couldn\u2019t claim the shop.')
            setTimeout(() => router.push('/shop'), 1500)
            return
          }
        } catch {
          setError('Signed in, but we couldn\u2019t claim the shop.')
          setTimeout(() => router.push('/shop'), 1500)
          return
        }
      }

      // Role-based redirect after login (skip in mobile app — always go to customer home)
      if (!isApp) {
        const res = await fetch('/api/me')
        if (res.ok) {
          const { user: me } = await res.json()
          if (me?.role === 'driver') { router.push('/driver'); return }
          if (me?.role === 'shop_owner') { router.push('/shop'); return }
          if (me?.role === 'admin' || isAnyManager(me?.role)) { router.push('/admin'); return }
        }
      }
      router.push('/')
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #FFF0F5 0%, #FFFFFF 50%, #FFFAF0 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem',
    }}>
      <div style={{
        background: 'white', borderRadius: '20px', padding: '2.5rem',
        maxWidth: '420px', width: '100%',
        boxShadow: '0 8px 40px rgba(255, 20, 147, 0.08)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Link href="/" style={{ display: 'inline-block', textDecoration: 'none' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center' }}><img src="/logo.png" alt="DonutDash" style={{ height: '60px', width: 'auto' }} /><sup style={{ fontSize: 11, fontWeight: 700, marginLeft: 1 }}>™</sup></span>
          </Link>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1A1A2E', marginTop: '1rem' }}>
            {claimShopId ? 'Sign in to claim your shop' : 'Welcome back'}
          </h1>
          <p style={{ color: '#888', fontSize: '0.9rem', marginTop: '0.35rem' }}>
            {claimShopId ? 'We\u2019ll finish claiming the shop after you sign in' : 'Sign in to your account'}
          </p>
        </div>

        {claimShopId && (
          <div style={{
            background: '#FFF0F5', border: '1px solid #FFD6E7',
            borderRadius: '10px', padding: '0.75rem 1rem',
            marginBottom: '1rem', fontSize: '0.85rem', color: '#1A1A2E',
          }}>
            You&apos;re signing in to claim a shop. Your account must be a shop owner.
          </div>
        )}

        {claimMessage && (
          <div style={{
            background: '#F0FFF4', border: '1px solid #9AE6B4',
            borderRadius: '10px', padding: '0.75rem 1rem',
            marginBottom: '1rem', fontSize: '0.85rem', color: '#22543D',
          }}>
            {claimMessage}
          </div>
        )}

        {error && (
          <div style={{
            background: '#F8D7DA', borderRadius: '10px', padding: '0.75rem 1rem',
            marginBottom: '1rem', fontSize: '0.85rem', color: '#721C24',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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

          <div>
            <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: '0.35rem', color: '#1A1A2E' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="Your password"
                style={{
                  width: '100%', padding: '0.75rem 1rem', paddingRight: '3rem', borderRadius: '10px',
                  border: '1px solid #ddd', fontSize: '0.95rem', outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')}
                onBlur={e => (e.currentTarget.style.borderColor = '#ddd')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                  color: '#888', fontSize: '1.1rem',
                }}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <Link href="/forgot-password" style={{ fontSize: '0.85rem', color: '#FF1493', textDecoration: 'none', fontWeight: 500 }}>
              Forgot password?
            </Link>
          </div>

          {!isApp && <Turnstile onToken={setCaptchaToken} />}

          <button
            type="submit"
            disabled={loading || !captchaToken}
            style={{
              width: '100%', padding: '0.85rem',
              background: (loading || !captchaToken) ? '#ccc' : '#FF1493',
              color: 'white', border: 'none', borderRadius: '10px',
              fontSize: '1rem', fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s', marginTop: '0.5rem',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#FF69B4' }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#FF1493' }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem', color: '#666' }}>
          Don&apos;t have an account?{' '}
          <Link
            href={claimShopId ? `/signup?role=shop_owner&claim=${claimShopId}` : '/signup'}
            style={{ color: '#FF1493', fontWeight: 600 }}
          >
            Sign Up
          </Link>
        </p>

        {!isApp && (
          <div style={{
            marginTop: '1.25rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid #eee',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '0.8rem', color: '#888', margin: '0 0 0.5rem' }}>
              Driver? Get the DonutDash Driver app
            </p>
            <a
              href="https://apps.apple.com/us/app/donutdash-driver/id6762642387"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-block' }}
            >
              <img
                src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
                alt="Download DonutDash Driver on the App Store"
                style={{ height: '36px' }}
              />
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
