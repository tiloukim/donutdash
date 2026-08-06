'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'

export default function ResetPasswordPage() {
  const { supabase } = useAuth()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess(true)
      setTimeout(() => router.push('/'), 2000)
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
            <span style={{ display: 'inline-flex', alignItems: 'center' }}><img src="/logo.png" alt="DonutDash" style={{ height: '60px', width: 'auto' }} /><sup style={{ fontSize: 12, fontWeight: 800, marginLeft: 1, position: 'relative', top: 6 }}>™</sup></span>
          </Link>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1A1A2E', margin: '1rem 0 0.25rem' }}>
            Set New Password
          </h1>
          <p style={{ color: '#888', fontSize: '0.85rem' }}>
            Enter your new password below
          </p>
        </div>

        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1A1A2E', marginBottom: '0.5rem' }}>
              Password updated!
            </h2>
            <p style={{ color: '#888', fontSize: '0.85rem' }}>
              Redirecting you to the homepage...
            </p>
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
                New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="At least 6 characters"
                  style={{
                    width: '100%', padding: '0.75rem 1rem', paddingRight: '3rem', borderRadius: '10px',
                    border: '1px solid #ddd', fontSize: '0.95rem', outline: 'none',
                  }}
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

            <div>
              <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: '0.35rem', color: '#1A1A2E' }}>
                Confirm Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  placeholder="Re-enter password"
                  style={{
                    width: '100%', padding: '0.75rem 1rem', paddingRight: '3rem', borderRadius: '10px',
                    border: '1px solid #ddd', fontSize: '0.95rem', outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                    color: '#888', fontSize: '1.1rem',
                  }}
                >
                  {showConfirm ? '🙈' : '👁️'}
                </button>
              </div>
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
              }}
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
