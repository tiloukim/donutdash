'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
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
  const searchParams = useSearchParams()
  const isApp = searchParams.get('app') === '1' || (typeof window !== 'undefined' && !!(window as unknown as Record<string, unknown>).ReactNativeWebView)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [captchaToken, setCaptchaToken] = useState(isApp ? 'app-bypass' : '')
  const [smsConsent, setSmsConsent] = useState(false)
  const [showConfirmEmail, setShowConfirmEmail] = useState(false)

  // Phone verification state (drivers and shop owners)
  const isDriver = role === 'driver' || role === 'shop_owner'
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [verifyStep, setVerifyStep] = useState<'idle' | 'sent' | 'verified'>('idle')
  const [verifyCode, setVerifyCode] = useState('')
  const [verifySending, setVerifySending] = useState(false)
  const [verifyError, setVerifyError] = useState('')

  const formatPhoneForApi = (p: string) => {
    const digits = p.replace(/\D/g, '')
    if (digits.length === 10) return `+1${digits}`
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
    return p.startsWith('+') ? p : `+${digits}`
  }

  const handleSendCode = async () => {
    if (!phone.trim()) { setVerifyError('Enter your phone number first.'); return }
    setVerifySending(true)
    setVerifyError('')
    try {
      const res = await fetch('/api/verify/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formatPhoneForApi(phone) }),
      })
      const data = await res.json()
      if (!res.ok) { setVerifyError(data.error || 'Failed to send code.'); return }
      setVerifyStep('sent')
    } catch { setVerifyError('Failed to send code.') }
    finally { setVerifySending(false) }
  }

  const handleCheckCode = async () => {
    if (!verifyCode.trim()) { setVerifyError('Enter the 6-digit code.'); return }
    setVerifySending(true)
    setVerifyError('')
    try {
      const res = await fetch('/api/verify/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formatPhoneForApi(phone), code: verifyCode }),
      })
      const data = await res.json()
      if (data.verified) {
        setVerifyStep('verified')
        setPhoneVerified(true)
      } else {
        setVerifyError(data.error || 'Invalid code.')
      }
    } catch { setVerifyError('Verification failed.') }
    finally { setVerifySending(false) }
  }

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
      if (mode === 'login') {
        let signInError: { message: string } | null = null

        if (isApp) {
          const res = await fetch('/api/auth/app-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          })
          const result = await res.json()
          if (!res.ok) {
            signInError = { message: result.error || 'Login failed' }
          } else if (result.session) {
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
        // Page will re-render with auth, layout will show dashboard
      } else {
        if (password.length < 6) {
          setError('Password must be at least 6 characters.')
          return
        }
        if (isDriver && !phoneVerified) {
          setError('Please verify your phone number before signing up.')
          return
        }
        if (isDriver && !phone.trim()) {
          setError('Phone number is required for drivers.')
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
                  Phone {isDriver
                    ? <span style={{ fontSize: '0.75rem', color: accentColor, fontWeight: 400 }}>(required)</span>
                    : <span style={{ fontSize: '0.75rem', color: '#999', fontWeight: 400 }}>(optional)</span>
                  }
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => { setPhone(e.target.value); if (phoneVerified) { setPhoneVerified(false); setVerifyStep('idle') } }}
                    placeholder="(903) 555-1234"
                    required={isDriver}
                    disabled={verifyStep === 'verified'}
                    style={{ ...inputStyle, flex: 1 }}
                    onFocus={e => (e.currentTarget.style.borderColor = accentColor)}
                    onBlur={e => (e.currentTarget.style.borderColor = '#ddd')}
                  />
                  {isDriver && mode === 'signup' && verifyStep !== 'verified' && (
                    <button
                      type="button"
                      onClick={handleSendCode}
                      disabled={verifySending || !phone.trim()}
                      style={{
                        padding: '0 16px', borderRadius: '10px', border: 'none',
                        background: verifySending ? '#ccc' : accentColor,
                        color: '#fff', fontWeight: 600, fontSize: '0.85rem',
                        cursor: verifySending ? 'wait' : 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      {verifySending ? '...' : verifyStep === 'sent' ? 'Resend' : 'Verify'}
                    </button>
                  )}
                  {verifyStep === 'verified' && (
                    <div style={{
                      display: 'flex', alignItems: 'center', padding: '0 12px',
                      background: '#D1FAE5', borderRadius: '10px', fontSize: '0.85rem',
                      fontWeight: 600, color: '#065F46', whiteSpace: 'nowrap',
                    }}>
                      ✓ Verified
                    </div>
                  )}
                </div>

                {/* OTP code input */}
                {isDriver && mode === 'signup' && verifyStep === 'sent' && (
                  <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={verifyCode}
                      onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter 6-digit code"
                      maxLength={6}
                      style={{ ...inputStyle, flex: 1, letterSpacing: '4px', textAlign: 'center', fontWeight: 700, fontSize: '1.1rem' }}
                      onFocus={e => (e.currentTarget.style.borderColor = accentColor)}
                      onBlur={e => (e.currentTarget.style.borderColor = '#ddd')}
                    />
                    <button
                      type="button"
                      onClick={handleCheckCode}
                      disabled={verifySending || verifyCode.length < 6}
                      style={{
                        padding: '0 20px', borderRadius: '10px', border: 'none',
                        background: verifySending || verifyCode.length < 6 ? '#ccc' : '#10B981',
                        color: '#fff', fontWeight: 700, fontSize: '0.9rem',
                        cursor: verifySending ? 'wait' : 'pointer',
                      }}
                    >
                      {verifySending ? '...' : 'Confirm'}
                    </button>
                  </div>
                )}

                {verifyError && (
                  <p style={{ color: '#DC2626', fontSize: '0.8rem', margin: '4px 0 0' }}>{verifyError}</p>
                )}
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
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
                style={{ ...inputStyle, paddingRight: '3rem' }}
                onFocus={e => (e.currentTarget.style.borderColor = accentColor)}
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
                Message frequency varies. Message &amp; data rates may apply. Reply HELP for help. Reply STOP to unsubscribe.
                Your mobile information will not be sold or shared with third parties for promotional or marketing purposes.{' '}
                <Link href="/privacy" style={{ color: accentColor, textDecoration: 'underline' }}>
                  Privacy Policy
                </Link>
              </label>
            </div>
          )}

          {!isApp && <Turnstile onToken={setCaptchaToken} />}

          <button
            type="submit"
            disabled={loading || !captchaToken}
            style={{
              width: '100%',
              padding: '0.85rem',
              background: (loading || !captchaToken) ? '#ccc' : accentColor,
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
