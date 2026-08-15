'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { useCart } from '@/lib/cart-context'
import { useAuth } from '@/lib/auth-context'

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
  const [orderId] = useState(orderIdParam)
  const { clearCart } = useCart()
  const { supabase, refreshUser } = useAuth()

  // Guest → account conversion. Only guests (anonymous sessions) see the prompt.
  const [isGuest, setIsGuest] = useState(false)
  const [saveEmail, setSaveEmail] = useState('')
  const [savePassword, setSavePassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    clearCart()
  }, [clearCart])

  // Was this order placed as a guest? Anonymous sessions can be upgraded to a
  // real account in place, keeping all their orders.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsGuest(data.user?.is_anonymous === true)
    }).catch(() => {})
  }, [supabase])

  const handleSaveAccount = async () => {
    if (!saveEmail.trim()) { setSaveError('Enter your email.'); return }
    if (savePassword.length < 8) { setSaveError('Choose a password of at least 8 characters.'); return }
    setSaving(true)
    setSaveError('')
    try {
      // Attach email + password to the SAME anonymous user — no data migration,
      // so every order placed as a guest carries over to the new account.
      const { error } = await supabase.auth.updateUser({ email: saveEmail.trim(), password: savePassword })
      if (error) {
        const msg = (error.message || '').toLowerCase()
        if (msg.includes('registered') || msg.includes('already')) {
          setSaveError('That email already has an account. Please sign in to it instead.')
        } else if (msg.includes('password')) {
          setSaveError(error.message)
        } else {
          setSaveError('Could not save your account. Please try again.')
        }
        return
      }
      // Sync the profile row (guest email → real email) and refresh context.
      await fetch('/api/auth/convert-guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: saveEmail.trim() }),
      }).catch(() => {})
      await refreshUser()
      setSaved(true)
    } catch {
      setSaveError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

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

          {isGuest && !saved && (
            <div style={{
              background: 'white', border: '1px solid #FFD3E6', borderRadius: 14,
              padding: '1.25rem', marginBottom: '2rem', textAlign: 'left',
              boxShadow: '0 2px 10px rgba(255,20,147,0.06)',
            }}>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1A1A2E', marginBottom: 4 }}>
                💾 Save your order history
              </div>
              <p style={{ color: '#777', fontSize: '0.88rem', margin: '0 0 0.9rem', lineHeight: 1.5 }}>
                Add a password to keep this order and reorder faster next time — on any device.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <input type="email" value={saveEmail} onChange={e => setSaveEmail(e.target.value)}
                  placeholder="you@example.com" autoComplete="email"
                  style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: 10, border: '1px solid #ddd', fontSize: '1rem', outline: 'none' }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')} onBlur={e => (e.currentTarget.style.borderColor = '#ddd')} />
                <input type="password" value={savePassword} onChange={e => setSavePassword(e.target.value)}
                  placeholder="Create a password (8+ characters)" autoComplete="new-password"
                  style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: 10, border: '1px solid #ddd', fontSize: '1rem', outline: 'none' }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')} onBlur={e => (e.currentTarget.style.borderColor = '#ddd')} />
                {saveError && <p style={{ color: '#DC2626', fontSize: '0.82rem', margin: 0 }}>{saveError}</p>}
                <button type="button" onClick={handleSaveAccount} disabled={saving}
                  style={{
                    width: '100%', padding: '0.85rem', borderRadius: 10, border: 'none',
                    background: saving ? '#ccc' : '#FF1493', color: 'white', fontWeight: 700,
                    fontSize: '0.98rem', cursor: saving ? 'wait' : 'pointer',
                  }}>
                  {saving ? 'Saving…' : 'Save my account'}
                </button>
              </div>
            </div>
          )}

          {saved && (
            <div style={{
              background: '#D1FAE5', border: '1px solid #A7F3D0', borderRadius: 14,
              padding: '1rem 1.25rem', marginBottom: '2rem', color: '#065F46', fontWeight: 600,
            }}>
              ✓ Account saved — your orders are now safe. You can sign in with that email anytime.
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
