'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import Navbar from '@/components/Navbar'

export default function DeleteAccountPage() {
  const router = useRouter()
  const { user, supabase } = useAuth()
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  if (!user) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <Navbar />
        <div style={{ maxWidth: 500, margin: '60px auto', padding: '0 20px', textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Delete Account</h1>
          <p style={{ color: '#666' }}>Please <a href="/login" style={{ color: '#FF8C00' }}>sign in</a> first to delete your account.</p>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <Navbar />
        <div style={{ maxWidth: 500, margin: '60px auto', padding: '0 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#x2705;</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Account Deleted</h1>
          <p style={{ color: '#666', marginBottom: 24 }}>
            Your account and all associated data have been permanently deleted.
          </p>
          <a href="/" style={{
            display: 'inline-block', padding: '12px 32px', borderRadius: 10,
            background: '#FF8C00', color: '#fff', fontWeight: 700, textDecoration: 'none',
          }}>
            Go to Homepage
          </a>
        </div>
      </div>
    )
  }

  const handleDelete = async () => {
    if (confirmation !== 'DELETE MY ACCOUNT') {
      setError('Please type "DELETE MY ACCOUNT" exactly to confirm.')
      return
    }
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation }),
      })

      if (res.ok) {
        await supabase.auth.signOut()
        setDone(true)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to delete account.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 500, margin: '40px auto', padding: '0 20px' }}>
        <button onClick={() => router.back()} style={{
          background: 'none', border: 'none', color: '#FF8C00', fontWeight: 600,
          fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 20,
        }}>
          &larr; Back
        </button>

        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#DC2626', marginBottom: 8 }}>Delete Account</h1>
        <p style={{ color: '#666', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          This will permanently delete your DonutDash account and all associated data including:
        </p>

        <ul style={{ color: '#555', fontSize: 14, lineHeight: 2, marginBottom: 24, paddingLeft: 20 }}>
          <li>Your profile and personal information</li>
          <li>Order history</li>
          <li>Saved favorites and preferences</li>
          <li>Rewards points</li>
          <li>Reviews you&apos;ve written</li>
        </ul>

        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12,
          padding: 20, marginBottom: 24,
        }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#DC2626', margin: '0 0 8px' }}>
            This action cannot be undone.
          </p>
          <p style={{ fontSize: 13, color: '#555', margin: '0 0 14px' }}>
            Type <strong>DELETE MY ACCOUNT</strong> below to confirm:
          </p>
          <input
            type="text"
            value={confirmation}
            onChange={e => setConfirmation(e.target.value)}
            placeholder="DELETE MY ACCOUNT"
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 8,
              border: '1.5px solid #FECACA', fontSize: 14, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {error && (
          <div style={{ background: '#FEE2E2', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#DC2626', fontSize: 13 }}>
            {error}
          </div>
        )}

        <button
          onClick={handleDelete}
          disabled={loading || confirmation !== 'DELETE MY ACCOUNT'}
          style={{
            width: '100%', padding: '14px', borderRadius: 10, border: 'none',
            background: loading || confirmation !== 'DELETE MY ACCOUNT' ? '#ccc' : '#DC2626',
            color: '#fff', fontSize: 16, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Deleting...' : 'Permanently Delete My Account'}
        </button>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#999' }}>
          Need help? Contact <a href="mailto:support@donutdash.app" style={{ color: '#FF8C00' }}>support@donutdash.app</a>
        </p>
      </div>
    </div>
  )
}
