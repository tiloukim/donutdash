'use client'

import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import MobileBottomNav from '@/components/MobileBottomNav'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'

interface GiftCard {
  id: string
  code: string
  amount: number
  balance: number
  purchased_by: string | null
  recipient_email: string | null
  recipient_name: string | null
  message: string | null
  status: string
  created_at: string
  redeemed_by: string | null
  redeemed_at: string | null
}

const AMOUNTS = [10, 25, 50, 100]

export default function GiftCardsPage() {
  const { user, loading: authLoading } = useAuth()
  const [tab, setTab] = useState<'buy' | 'redeem' | 'history'>('redeem')
  const [amount, setAmount] = useState(25)
  const [recipientName, setRecipientName] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [redeemCode, setRedeemCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [redeemResult, setRedeemResult] = useState<string | null>(null)
  const [redeemError, setRedeemError] = useState<string | null>(null)

  const [purchased, setPurchased] = useState<GiftCard[]>([])
  const [received, setReceived] = useState<GiftCard[]>([])
  const [loadingCards, setLoadingCards] = useState(false)

  useEffect(() => {
    if (user && tab === 'history') {
      setLoadingCards(true)
      fetch('/api/gift-cards')
        .then(r => r.json())
        .then(data => {
          setPurchased(data.purchased || [])
          setReceived(data.received || [])
        })
        .catch(() => {})
        .finally(() => setLoadingCards(false))
    }
  }, [user, tab])

  async function handleBuy() {
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/gift-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, recipient_email: recipientEmail, recipient_name: recipientName, message }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuccess(`Gift card created! Code: ${data.card.code}`)
      setRecipientName('')
      setRecipientEmail('')
      setMessage('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create gift card')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRedeem() {
    setRedeeming(true)
    setRedeemError(null)
    setRedeemResult(null)
    try {
      const res = await fetch('/api/gift-cards/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: redeemCode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRedeemResult(data.message)
      setRedeemCode('')
    } catch (e: unknown) {
      setRedeemError(e instanceof Error ? e.message : 'Failed to redeem gift card')
    } finally {
      setRedeeming(false)
    }
  }

  const statusColor = (s: string) => {
    if (s === 'active') return '#10B981'
    if (s === 'redeemed') return '#6366F1'
    return '#9CA3AF'
  }

  if (authLoading) {
    return (
      <>
        <Navbar />
        <div style={{ minHeight: '60vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Loading...</div>
      </>
    )
  }

  if (!user) {
    return (
      <>
        <Navbar />
        <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24 }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Sign in to access Gift Cards</h2>
          <Link href="/login" style={{ background: '#FF1493', color: '#fff', padding: '0.75rem 2rem', borderRadius: 10, fontWeight: 600, textDecoration: 'none' }}>Sign In</Link>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '40px 16px 100px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: '3rem', marginBottom: 8 }}>🎁</div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>DonutDash™ Gift Cards</h1>
          <p style={{ color: '#666', fontSize: '1.05rem' }}>Share the sweetness with someone special</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 32, borderRadius: 12, overflow: 'hidden', border: '2px solid #FF1493' }}>
          {(['redeem', 'history'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '12px 0', fontWeight: 700, fontSize: '0.95rem', border: 'none', cursor: 'pointer',
              background: tab === t ? '#FF1493' : '#fff',
              color: tab === t ? '#fff' : '#FF1493',
              transition: 'all 0.2s',
            }}>
              {t === 'redeem' ? 'Redeem' : 'My Cards'}
            </button>
          ))}
        </div>

        {/* Buy tab */}
        {tab === 'buy' && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 20 }}>Select Amount</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
              {AMOUNTS.map(a => (
                <button key={a} onClick={() => setAmount(a)} style={{
                  padding: '16px 0', borderRadius: 12, fontWeight: 800, fontSize: '1.2rem',
                  border: amount === a ? '3px solid #FF1493' : '2px solid #e5e7eb',
                  background: amount === a ? '#FFF0F5' : '#fff',
                  color: amount === a ? '#FF1493' : '#374151',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  ${a}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem', color: '#374151' }}>Recipient Name</label>
                <input
                  value={recipientName}
                  onChange={e => setRecipientName(e.target.value)}
                  placeholder="Who is this for?"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem', color: '#374151' }}>Recipient Email</label>
                <input
                  value={recipientEmail}
                  onChange={e => setRecipientEmail(e.target.value)}
                  placeholder="their@email.com"
                  type="email"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem', color: '#374151' }}>Personal Message (optional)</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Enjoy some donuts on me!"
                  rows={3}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: '1rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {error && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: '0.9rem' }}>{error}</div>}
            {success && <div style={{ background: '#D1FAE5', color: '#065F46', padding: '14px', borderRadius: 10, marginBottom: 16, fontSize: '0.95rem', fontWeight: 600, wordBreak: 'break-all' }}>{success}</div>}

            <button
              onClick={handleBuy}
              disabled={submitting}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: submitting ? '#F9A8D4' : '#FF1493', color: '#fff', fontWeight: 700, fontSize: '1.05rem',
                transition: 'background 0.2s',
              }}
            >
              {submitting ? 'Creating...' : `Buy $${amount} Gift Card`}
            </button>
          </div>
        )}

        {/* Redeem tab */}
        {tab === 'redeem' && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🎉</div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Have a gift card? Redeem it here!</h2>
              <p style={{ color: '#666', fontSize: '0.9rem', marginTop: 4 }}>The balance will be added to your account credit</p>
            </div>

            <input
              value={redeemCode}
              onChange={e => setRedeemCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              maxLength={19}
              style={{
                width: '100%', padding: '14px', borderRadius: 10, border: '2px solid #e5e7eb', fontSize: '1.1rem',
                textAlign: 'center', letterSpacing: 2, fontWeight: 700, fontFamily: 'monospace', outline: 'none', marginBottom: 16, boxSizing: 'border-box',
              }}
            />

            {redeemError && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: '0.9rem' }}>{redeemError}</div>}
            {redeemResult && <div style={{ background: '#D1FAE5', color: '#065F46', padding: '14px', borderRadius: 10, marginBottom: 16, fontSize: '0.95rem', fontWeight: 600 }}>{redeemResult}</div>}

            <button
              onClick={handleRedeem}
              disabled={redeeming || redeemCode.length < 4}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: redeeming || redeemCode.length < 4 ? '#F9A8D4' : '#FF1493', color: '#fff', fontWeight: 700, fontSize: '1.05rem',
                transition: 'background 0.2s',
              }}
            >
              {redeeming ? 'Redeeming...' : 'Redeem Gift Card'}
            </button>
          </div>
        )}

        {/* History tab */}
        {tab === 'history' && (
          <div>
            {loadingCards ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading your gift cards...</div>
            ) : (
              <>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12 }}>Purchased Gift Cards</h3>
                {purchased.length === 0 ? (
                  <div style={{ background: '#fff', borderRadius: 12, padding: 24, textAlign: 'center', color: '#888', marginBottom: 24, border: '1px solid #f0f0f0' }}>
                    No gift cards purchased yet
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
                    {purchased.map(card => (
                      <div key={card.id} style={{
                        background: '#fff', borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
                        border: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
                      }}>
                        <div>
                          <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1rem', letterSpacing: 1, marginBottom: 4 }}>{card.code}</div>
                          <div style={{ fontSize: '0.85rem', color: '#666' }}>
                            {card.recipient_name ? `To: ${card.recipient_name}` : 'No recipient specified'}
                            {' | '}
                            {new Date(card.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#1A1A2E' }}>${card.amount.toFixed(2)}</div>
                          <span style={{
                            display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem',
                            fontWeight: 700, color: '#fff', background: statusColor(card.status), marginTop: 2,
                          }}>{card.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12 }}>Received Gift Cards</h3>
                {received.length === 0 ? (
                  <div style={{ background: '#fff', borderRadius: 12, padding: 24, textAlign: 'center', color: '#888', border: '1px solid #f0f0f0' }}>
                    No gift cards received yet
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {received.map(card => (
                      <div key={card.id} style={{
                        background: '#fff', borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
                        border: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
                      }}>
                        <div>
                          <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1rem', letterSpacing: 1, marginBottom: 4 }}>{card.code}</div>
                          <div style={{ fontSize: '0.85rem', color: '#666' }}>
                            Redeemed {card.redeemed_at ? new Date(card.redeemed_at).toLocaleDateString() : ''}
                          </div>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#6366F1' }}>${card.amount.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <MobileBottomNav />
    </>
  )
}
