'use client'

import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import MobileBottomNav from '@/components/MobileBottomNav'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'

interface Shop {
  id: string
  name: string
  slug: string
  image_url: string | null
}

interface CateringRequest {
  id: string
  shop: Shop
  event_date: string
  event_time: string | null
  guest_count: number | null
  items_description: string
  delivery_address: string | null
  budget: string | null
  status: string
  quote_amount: number | null
  admin_notes: string | null
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  quoted: '#6366F1',
  confirmed: '#10B981',
  completed: '#374151',
  cancelled: '#EF4444',
}

const BUDGET_OPTIONS = ['Under $100', '$100 - $250', '$250 - $500', '$500 - $1,000', '$1,000+']

export default function CateringPage() {
  const { user, loading: authLoading } = useAuth()
  const [shops, setShops] = useState<Shop[]>([])
  const [requests, setRequests] = useState<CateringRequest[]>([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [tab, setTab] = useState<'request' | 'history'>('request')

  const [shopId, setShopId] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventTime, setEventTime] = useState('')
  const [guestCount, setGuestCount] = useState('')
  const [itemsDescription, setItemsDescription] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [budget, setBudget] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/shops')
      .then(r => r.json())
      .then(data => setShops(data.shops || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (user && tab === 'history') {
      setLoadingRequests(true)
      fetch('/api/catering')
        .then(r => r.json())
        .then(data => setRequests(data.requests || []))
        .catch(() => {})
        .finally(() => setLoadingRequests(false))
    }
  }, [user, tab])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/catering', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: shopId,
          event_date: eventDate,
          event_time: eventTime || null,
          guest_count: guestCount ? Number(guestCount) : null,
          items_description: itemsDescription,
          delivery_address: deliveryAddress || null,
          budget: budget || null,
          phone: phone || null,
          email: email || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuccess('Catering request submitted! We will get back to you with a quote.')
      setShopId('')
      setEventDate('')
      setEventTime('')
      setGuestCount('')
      setItemsDescription('')
      setDeliveryAddress('')
      setBudget('')
      setPhone('')
      setEmail('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit request')
    } finally {
      setSubmitting(false)
    }
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
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Sign in to request catering</h2>
          <Link href="/login" style={{ background: '#FF1493', color: '#fff', padding: '0.75rem 2rem', borderRadius: 10, fontWeight: 600, textDecoration: 'none' }}>Sign In</Link>
        </div>
        <Footer />
      </>
    )
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb',
    fontSize: '1rem', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = { display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem', color: '#374151' }

  return (
    <>
      <Navbar />
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '40px 16px 100px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: '3rem', marginBottom: 8 }}>🍩</div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>Catering & Large Orders</h1>
          <p style={{ color: '#666', fontSize: '1.05rem' }}>Perfect for events, meetings, and celebrations</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 32, borderRadius: 12, overflow: 'hidden', border: '2px solid #FF1493' }}>
          {(['request', 'history'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '12px 0', fontWeight: 700, fontSize: '0.95rem', border: 'none', cursor: 'pointer',
              background: tab === t ? '#FF1493' : '#fff',
              color: tab === t ? '#fff' : '#FF1493',
              transition: 'all 0.2s',
            }}>
              {t === 'request' ? 'New Request' : 'My Requests'}
            </button>
          ))}
        </div>

        {tab === 'request' && (
          <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Shop *</label>
                <select value={shopId} onChange={e => setShopId(e.target.value)} required style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">Select a shop</option>
                  {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Event Date *</label>
                  <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Event Time</label>
                  <input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Guest Count</label>
                  <input type="number" value={guestCount} onChange={e => setGuestCount(e.target.value)} placeholder="e.g. 50" min="1" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Budget Range</label>
                  <select value={budget} onChange={e => setBudget(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="">Select budget</option>
                    {BUDGET_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>What do you need? *</label>
                <textarea
                  value={itemsDescription}
                  onChange={e => setItemsDescription(e.target.value)}
                  required
                  placeholder="e.g. 5 dozen assorted donuts, 2 gallon coffees, donut holes for 50 people..."
                  rows={4}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={labelStyle}>Delivery Address</label>
                <input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="Where should we deliver?" style={inputStyle} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 123-4567" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" style={inputStyle} />
                </div>
              </div>
            </div>

            {error && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '10px 14px', borderRadius: 10, marginTop: 16, fontSize: '0.9rem' }}>{error}</div>}
            {success && <div style={{ background: '#D1FAE5', color: '#065F46', padding: '14px', borderRadius: 10, marginTop: 16, fontSize: '0.95rem', fontWeight: 600 }}>{success}</div>}

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: submitting ? '#F9A8D4' : '#FF1493', color: '#fff', fontWeight: 700, fontSize: '1.05rem',
                transition: 'background 0.2s', marginTop: 24,
              }}
            >
              {submitting ? 'Submitting...' : 'Submit Catering Request'}
            </button>
          </form>
        )}

        {tab === 'history' && (
          <div>
            {loadingRequests ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading your requests...</div>
            ) : requests.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: '#888', border: '1px solid #f0f0f0' }}>
                No catering requests yet. Submit one to get started!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {requests.map(req => (
                  <div key={req.id} style={{
                    background: '#fff', borderRadius: 14, padding: '20px', boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
                    border: '1px solid #f0f0f0',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{req.shop?.name || 'Shop'}</div>
                        <div style={{ fontSize: '0.85rem', color: '#666' }}>
                          {new Date(req.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                          {req.event_time && ` at ${req.event_time}`}
                          {req.guest_count && ` | ${req.guest_count} guests`}
                        </div>
                      </div>
                      <span style={{
                        padding: '4px 12px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700,
                        color: '#fff', background: STATUS_COLORS[req.status] || '#9CA3AF',
                      }}>{req.status}</span>
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#374151', marginBottom: 8 }}>{req.items_description}</div>
                    {req.quote_amount && (
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#6366F1' }}>
                        Quote: ${req.quote_amount.toFixed(2)}
                      </div>
                    )}
                    {req.admin_notes && (
                      <div style={{ fontSize: '0.85rem', color: '#666', marginTop: 4, fontStyle: 'italic' }}>
                        Note: {req.admin_notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <MobileBottomNav />
      <Footer />
    </>
  )
}
