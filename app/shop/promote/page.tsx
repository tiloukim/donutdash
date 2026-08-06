'use client'

import { useEffect, useState, useCallback } from 'react'
import SquarePaymentForm from '@/components/SquarePaymentForm'

interface Plan { id: string; label: string; days: number; price: number; rank: number; blurb: string; best?: boolean }
interface HistoryRow { plan: string; amount: number; days: number; starts_at: string; ends_at: string; created_at: string }
interface Status {
  shopName: string
  sponsored: boolean
  sponsor_expires_at: string | null
  sponsor_headline: string | null
  sponsor_banner_url: string | null
  plans: Plan[]
  history: HistoryRow[]
}

const ORANGE = '#FF8C00'
const card: React.CSSProperties = { background: '#fff', borderRadius: 16, border: '1px solid #f0f0f0', padding: '1.25rem 1.4rem', marginBottom: '1.25rem' }
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default function PromotePage() {
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [headline, setHeadline] = useState('')
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/shop/sponsorship')
      .then(r => r.json())
      .then((d: Status) => {
        setStatus(d)
        setHeadline(d.sponsor_headline || '')
        setBannerUrl(d.sponsor_banner_url || null)
      })
      .catch(() => setError('Could not load sponsorship info.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const plan = status?.plans.find(p => p.id === selected) || null

  async function uploadBanner(file: File) {
    setError(''); setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file); fd.append('type', 'sponsor')
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const d = await res.json()
      if (!res.ok || !d.url) { setError(d.error || 'Upload failed'); return }
      setBannerUrl(d.url)
    } catch { setError('Upload failed — please try again.') }
    finally { setUploading(false) }
  }

  async function handleTokenize(token: string) {
    if (!selected) return
    setPaying(true); setError('')
    try {
      const res = await fetch('/api/shop/sponsorship', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selected, sourceId: token, headline, banner_url: bannerUrl }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'Payment failed. Please try again.'); return }
      setSuccess(`You're featured! Your shop is promoted until ${fmtDate(d.sponsor_expires_at)}.`)
      setSelected(null)
      load()
    } catch { setError('Something went wrong. Please try again.') }
    finally { setPaying(false) }
  }

  if (loading) return <div style={{ padding: '2rem', color: '#888' }}>Loading…</div>

  const activeUntil = status?.sponsored && status.sponsor_expires_at

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '1.5rem 1rem 4rem' }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1A1A2E', margin: '0 0 4px' }}>⭐ Promote your shop</h1>
      <p style={{ color: '#666', margin: '0 0 1.5rem', fontSize: '0.95rem' }}>
        Feature {status?.shopName || 'your shop'} on the DonutDash front page — a banner up top and first place in the shop list.
      </p>

      {success && (
        <div style={{ ...card, background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534', fontWeight: 600 }}>
          🎉 {success}
        </div>
      )}

      {/* Current status */}
      <div style={{ ...card, borderColor: activeUntil ? '#FFD8A8' : '#f0f0f0', background: activeUntil ? '#FFF8F0' : '#fff' }}>
        {activeUntil ? (
          <>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em', color: ORANGE, textTransform: 'uppercase' }}>● Featured now</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1A1A2E', marginTop: 4 }}>
              Your shop is promoted until {fmtDate(status!.sponsor_expires_at!)}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#8A5A00', marginTop: 4 }}>Buy again below to extend your feature.</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em', color: '#9CA3AF', textTransform: 'uppercase' }}>Not featured</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1A1A2E', marginTop: 4 }}>Pick a plan to get on the front page</div>
          </>
        )}
      </div>

      {/* Plans */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: '1.25rem' }}>
        {status?.plans.map(p => {
          const active = selected === p.id
          return (
            <button key={p.id} type="button" onClick={() => { setSelected(p.id); setSuccess(''); setError('') }}
              style={{
                textAlign: 'left', cursor: 'pointer', position: 'relative',
                background: active ? '#FFF8F0' : '#fff',
                border: active ? `2px solid ${ORANGE}` : '1px solid #e5e7eb',
                borderRadius: 14, padding: '1rem', transition: 'all 0.15s',
              }}>
              {p.best && (
                <span style={{ position: 'absolute', top: -9, right: 12, background: ORANGE, color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Best value</span>
              )}
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1A1A2E' }}>{p.label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: ORANGE, margin: '2px 0' }}>${p.price}</div>
              <div style={{ fontSize: '0.8rem', color: '#666', lineHeight: 1.4 }}>{p.blurb}</div>
            </button>
          )
        })}
      </div>

      {/* Customize + pay */}
      {plan && (
        <div style={card}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1A1A2E', margin: '0 0 2px' }}>Your banner</h3>
          <p style={{ fontSize: '0.82rem', color: '#888', margin: '0 0 1rem' }}>Shown on the front-page banner. Optional — we’ll use your shop banner if left blank.</p>

          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#555', marginBottom: 4 }}>Headline</label>
          <input type="text" maxLength={120} value={headline} onChange={e => setHeadline(e.target.value)}
            placeholder="Fresh hot donuts — 20% off your first order!"
            style={{ width: '100%', padding: '0.7rem 0.9rem', borderRadius: 10, border: '1px solid #ddd', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', marginBottom: '1rem' }} />

          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#555', marginBottom: 6 }}>Banner image</label>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: '1.25rem' }}>
            <div style={{
              width: 132, height: 66, flexShrink: 0, borderRadius: 10, overflow: 'hidden', border: '1px solid #e5e7eb',
              background: bannerUrl ? `linear-gradient(90deg, rgba(0,0,0,0.5), rgba(0,0,0,0.1)), url(${bannerUrl}) center/cover no-repeat` : '#F3F4F6',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 11, fontWeight: 600,
            }}>{!bannerUrl && 'No image'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <label style={{ padding: '0.6rem 1rem', borderRadius: 10, background: '#111827', color: '#fff', fontSize: 13, fontWeight: 600, cursor: uploading ? 'default' : 'pointer', opacity: uploading ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                  {uploading ? 'Uploading…' : '⬆ Upload image'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading}
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadBanner(f); e.target.value = '' }} />
                </label>
                {bannerUrl && (
                  <button type="button" onClick={() => setBannerUrl(null)} style={{ padding: '0.6rem 0.9rem', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#6B7280', fontSize: 13, cursor: 'pointer' }}>Remove</button>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>Wide image works best (~1200×400). JPG/PNG/WebP, max 5MB.</div>
            </div>
          </div>

          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1A1A2E', margin: '0 0 2px' }}>Payment</h3>
          <p style={{ fontSize: '0.82rem', color: '#888', margin: '0 0 1rem' }}>
            {plan.label} — <strong style={{ color: '#1A1A2E' }}>${plan.price}</strong>, featured for {plan.days} days.
          </p>

          {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 10, padding: '0.7rem 0.9rem', fontSize: '0.88rem', marginBottom: '1rem' }}>{error}</div>}

          <SquarePaymentForm total={plan.price} loading={paying} onTokenize={handleTokenize} onError={setError} />
        </div>
      )}

      {/* History */}
      {status && status.history.length > 0 && (
        <div style={card}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1A1A2E', margin: '0 0 0.75rem' }}>Past sponsorships</h3>
          {status.history.map((h, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#555', padding: '6px 0', borderTop: i === 0 ? 'none' : '1px solid #f2f2f2' }}>
              <span>{fmtDate(h.starts_at)} – {fmtDate(h.ends_at)}</span>
              <span style={{ fontWeight: 600, color: '#1A1A2E' }}>${Number(h.amount).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
