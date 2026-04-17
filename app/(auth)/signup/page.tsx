'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import Turnstile from '@/components/Turnstile'

const ROLES = [
  { value: 'customer', label: 'Customer', desc: 'Order delicious donuts' },
  { value: 'driver', label: 'Driver', desc: 'Deliver orders and earn money' },
  { value: 'shop_owner', label: 'Shop Owner', desc: 'Manage your donut shop' },
]

export default function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { supabase, refreshUser } = useAuth()
  const claimShopId = searchParams.get('claim')
  const rolePresetParam = searchParams.get('role')
  const rolePreset: 'customer' | 'driver' | 'shop_owner' | null =
    rolePresetParam === 'customer' || rolePresetParam === 'driver' || rolePresetParam === 'shop_owner'
      ? rolePresetParam
      : null

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'customer' | 'driver' | 'shop_owner'>(
    claimShopId ? 'shop_owner' : (rolePreset ?? 'customer')
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [smsConsent, setSmsConsent] = useState(false)
  const [showConfirmEmail, setShowConfirmEmail] = useState(false)
  const [claimMessage, setClaimMessage] = useState('')

  // If a preset role is provided, keep state in sync
  useEffect(() => {
    if (claimShopId) {
      setRole('shop_owner')
    } else if (rolePreset) {
      setRole(rolePreset)
    }
  }, [claimShopId, rolePreset])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      setLoading(false)
      return
    }
    if (!captchaToken) {
      setError('Please complete the CAPTCHA verification.')
      setLoading(false)
      return
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            name,
            phone: phone || null,
            role,
          },
          captchaToken,
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

        // If claiming a shop, attempt to claim it right away.
        if (claimShopId && role === 'shop_owner') {
          try {
            const claimRes = await fetch('/api/shop/claim', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ shop_id: claimShopId }),
            })
            if (claimRes.ok) {
              setClaimMessage('Shop claimed! Redirecting to your dashboard...')
              setTimeout(() => router.push('/shop'), 1000)
              return
            } else {
              const errData = await claimRes.json().catch(() => ({}))
              setError(errData.error || 'Signed up, but we couldn\u2019t claim the shop. Please try again from your dashboard.')
              setTimeout(() => router.push('/shop'), 2000)
              return
            }
          } catch {
            setError('Signed up, but we couldn\u2019t claim the shop. Please try again from your dashboard.')
            setTimeout(() => router.push('/shop'), 2000)
            return
          }
        }

        if (role === 'shop_owner') {
          router.push('/partner-setup')
        } else if (role === 'driver') {
          router.push('/driver')
        } else {
          router.push('/')
        }
      }
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%' as const,
    padding: '0.75rem 1rem',
    borderRadius: '10px',
    border: '1px solid #ddd',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.2s',
  }

  if (showConfirmEmail) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #FFF0F5 0%, #FFFFFF 50%, #FFFAF0 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '2rem',
      }}>
        <div style={{
          background: 'white', borderRadius: '20px', padding: '2.5rem',
          maxWidth: '420px', width: '100%', textAlign: 'center',
          boxShadow: '0 8px 40px rgba(255, 20, 147, 0.08)',
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
          <Link
            href="/login"
            style={{
              display: 'block', width: '100%', padding: '0.85rem',
              background: '#FF1493', color: 'white', border: 'none', borderRadius: '10px',
              fontSize: '1rem', fontWeight: 700, textDecoration: 'none', textAlign: 'center',
            }}
          >
            Go to Sign In
          </Link>
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
            <img src="/logo.png" alt="DonutDash" style={{ height: '60px', width: 'auto' }} />
          </Link>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1A1A2E', marginTop: '1rem' }}>
            {claimShopId ? 'Claim your shop' : 'Create an account'}
          </h1>
          <p style={{ color: '#888', fontSize: '0.9rem', marginTop: '0.35rem' }}>
            {claimShopId
              ? 'Create your shop owner account to finish claiming'
              : 'Join DonutDash today'}
          </p>
        </div>

        {claimShopId && (
          <div style={{
            background: '#FFF0F5', border: '1px solid #FFD6E7',
            borderRadius: '10px', padding: '0.75rem 1rem',
            marginBottom: '1rem', fontSize: '0.85rem', color: '#1A1A2E',
          }}>
            You&apos;re signing up to claim a shop. We&apos;ll assign it to your new account automatically.
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
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="John Doe"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')}
              onBlur={e => (e.currentTarget.style.borderColor = '#ddd')}
            />
          </div>

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
              onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')}
              onBlur={e => (e.currentTarget.style.borderColor = '#ddd')}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: '0.35rem', color: '#1A1A2E' }}>
              Phone Number <span style={{ fontSize: '0.75rem', color: '#999', fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')}
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
              placeholder="At least 6 characters"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')}
              onBlur={e => (e.currentTarget.style.borderColor = '#ddd')}
            />
          </div>

          {claimShopId ? (
            // When claiming a shop, lock role to shop_owner — no role picker
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              background: '#FFF0F5',
              border: '1.5px solid #FF1493',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.9rem',
              color: '#1A1A2E',
            }}>
              <span style={{ fontSize: '1.1rem' }}>🏪</span>
              <div>
                <div style={{ fontWeight: 700, color: '#FF1493' }}>Signing up as Shop Owner</div>
                <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '2px' }}>
                  Required to claim and manage a donut shop
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: '0.5rem', color: '#1A1A2E' }}>
                I am a...
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {ROLES.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value as typeof role)}
                    style={{
                      flex: 1, padding: '0.65rem 0.5rem', borderRadius: '10px',
                      border: role === r.value ? '2px solid #FF1493' : '1px solid #ddd',
                      background: role === r.value ? '#FFF0F5' : 'white',
                      cursor: 'pointer', textAlign: 'center',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{
                      fontWeight: 600, fontSize: '0.85rem',
                      color: role === r.value ? '#FF1493' : '#1A1A2E',
                    }}>
                      {r.label}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '0.15rem' }}>
                      {r.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <input
              type="checkbox"
              id="sms-consent"
              checked={smsConsent}
              onChange={e => setSmsConsent(e.target.checked)}
              style={{ marginTop: '3px', accentColor: '#FF1493', width: '16px', height: '16px', flexShrink: 0 }}
            />
            <label htmlFor="sms-consent" style={{ fontSize: '0.8rem', color: '#555', lineHeight: 1.5 }}>
              I agree to receive SMS notifications about my orders, delivery updates, and account alerts.
              Message frequency varies. Message &amp; data rates may apply. Reply HELP for help. Reply STOP to unsubscribe.
              Your mobile information will not be sold or shared with third parties for promotional or marketing purposes.{' '}
              <Link href="/privacy" style={{ color: '#FF1493', textDecoration: 'underline' }}>
                Privacy Policy
              </Link>
            </label>
          </div>

          <Turnstile onToken={setCaptchaToken} />

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
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem', color: '#666' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#FF1493', fontWeight: 600 }}>
            Sign In
          </Link>
        </p>
      </div>
    </div>
  )
}
