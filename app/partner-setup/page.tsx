'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'

export default function ShopSetupPage() {
  const router = useRouter()
  const { user, refreshUser } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'form' | 'hours' | 'menu'>('form')
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [savingHours, setSavingHours] = useState(false)
  const [hours, setHours] = useState(
    ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((_, i) => ({
      day_of_week: i, open_time: '06:00', close_time: '18:00', is_closed: false
    }))
  )

  const [shopName, setShopName] = useState('')
  const [description, setDescription] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [country, setCountry] = useState('US')
  const [phone, setPhone] = useState('')
  const [shopReferralCode, setShopReferralCode] = useState('')
  const [referralMsg, setReferralMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/shop/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: shopName,
          description,
          address,
          city,
          state,
          zip,
          country,
          phone,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to create shop')
        return
      }

      // Apply shop referral code if provided
      if (shopReferralCode.trim()) {
        await fetch('/api/shop/referral', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referral_code: shopReferralCode.trim() }),
        }).catch(() => {})
      }

      await refreshUser()
      setStep('hours')
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

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  const saveHours = async () => {
    setSavingHours(true)
    try {
      await fetch('/api/shop/hours', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(hours) })
      setStep('menu')
    } catch {
      alert('Failed to save hours')
    }
    setSavingHours(false)
  }

  const updateHour = (idx: number, field: string, value: string | boolean) => {
    setHours(prev => prev.map((h, i) => i === idx ? { ...h, [field]: value } : h))
  }

  const loadTemplate = async () => {
    setLoadingTemplate(true)
    try {
      const res = await fetch('/api/shop/menu/template', { method: 'POST' })
      if (res.ok) {
        router.push('/shop/menu')
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to load template')
        setLoadingTemplate(false)
      }
    } catch {
      alert('Failed to load template')
      setLoadingTemplate(false)
    }
  }

  const wrapperStyle = {
    minHeight: '100vh' as const,
    background: 'linear-gradient(135deg, #FFF0F5 0%, #FFFFFF 50%, #FFFAF0 100%)',
    display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    padding: '2rem',
  }
  const cardStyle = {
    background: 'white', borderRadius: '20px', padding: '2.5rem',
    maxWidth: '500px', width: '100%',
    boxShadow: '0 8px 40px rgba(255, 20, 147, 0.08)',
  }

  // Step indicator
  const StepIndicator = ({ current }: { current: number }) => (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
      {['Shop Info', 'Hours', 'Menu'].map((label, i) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700,
            background: i < current ? '#10B981' : i === current ? '#FF1493' : '#eee',
            color: i <= current ? '#fff' : '#aaa',
          }}>{i < current ? '\u2713' : i + 1}</div>
          <span style={{ fontSize: 12, color: i === current ? '#FF1493' : '#aaa', fontWeight: i === current ? 600 : 400 }}>{label}</span>
          {i < 2 && <div style={{ width: 20, height: 1, background: '#ddd' }} />}
        </div>
      ))}
    </div>
  )

  // STEP 2: Business Hours
  if (step === 'hours') {
    return (
      <div style={wrapperStyle}>
        <div style={cardStyle}>
          <StepIndicator current={1} />
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1A1A2E', marginBottom: 8 }}>
              Set Your Business Hours
            </h1>
            <p style={{ color: '#888', fontSize: '0.9rem' }}>
              When is your shop open? You can change these anytime.
            </p>
          </div>

          <div style={{ borderRadius: 12, border: '1px solid #FFE4EF', overflow: 'hidden', marginBottom: 20 }}>
            {hours.map((h, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
                borderBottom: i < 6 ? '1px solid #FFF0F5' : 'none',
                opacity: h.is_closed ? 0.5 : 1, fontSize: 13,
              }}>
                <span style={{ width: 70, fontWeight: 600, fontSize: 13 }}>{DAYS[i].slice(0, 3)}</span>
                <input type="time" value={h.open_time} onChange={e => updateHour(i, 'open_time', e.target.value)}
                  disabled={h.is_closed} style={{ padding: '4px 6px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 }} />
                <span style={{ color: '#888' }}>-</span>
                <input type="time" value={h.close_time} onChange={e => updateHour(i, 'close_time', e.target.value)}
                  disabled={h.is_closed} style={{ padding: '4px 6px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 }} />
                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                  <input type="checkbox" checked={h.is_closed} onChange={e => updateHour(i, 'is_closed', e.target.checked)} /> Closed
                </label>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={saveHours} disabled={savingHours} style={{
              flex: 1, padding: '0.85rem', background: savingHours ? '#ccc' : '#FF1493',
              color: 'white', border: 'none', borderRadius: '10px',
              fontSize: '1rem', fontWeight: 700, cursor: savingHours ? 'not-allowed' : 'pointer',
            }}>
              {savingHours ? 'Saving...' : 'Save & Continue'}
            </button>
            <button onClick={() => setStep('menu')} style={{
              padding: '0.85rem 1.5rem', background: 'white', color: '#888',
              border: '1px solid #ddd', borderRadius: '10px',
              fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
            }}>
              Skip
            </button>
          </div>
        </div>
      </div>
    )
  }

  // STEP 3: Menu Template
  if (step === 'menu') {
    return (
      <div style={wrapperStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' as const }}>
          <StepIndicator current={2} />
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#127849;</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1A1A2E', marginBottom: 8 }}>
            Set Up Your Menu
          </h1>
          <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: 28, lineHeight: 1.5 }}>
            Load our starter template with common donut shop items, or build your menu from scratch.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={loadTemplate}
              disabled={loadingTemplate}
              style={{
                width: '100%', padding: '0.85rem',
                background: loadingTemplate ? '#ccc' : '#FF1493',
                color: 'white', border: 'none', borderRadius: '10px',
                fontSize: '1rem', fontWeight: 700,
                cursor: loadingTemplate ? 'not-allowed' : 'pointer',
              }}
            >
              {loadingTemplate ? 'Loading Template...' : 'Load Starter Menu Template'}
            </button>
            <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>
              Adds ~27 common items (donuts, coffee, breakfast, drinks) with no prices. You set your own prices, upload photos, and turn items on when ready.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
              <div style={{ flex: 1, height: 1, background: '#eee' }} />
              <span style={{ fontSize: 12, color: '#aaa' }}>or</span>
              <div style={{ flex: 1, height: 1, background: '#eee' }} />
            </div>

            <button
              onClick={() => router.push('/shop/menu')}
              style={{
                width: '100%', padding: '0.85rem',
                background: 'white', color: '#FF1493',
                border: '2px solid #FF1493', borderRadius: '10px',
                fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              Build Menu From Scratch
            </button>
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
        maxWidth: '500px', width: '100%',
        boxShadow: '0 8px 40px rgba(255, 20, 147, 0.08)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Link href="/" style={{ display: 'inline-block', textDecoration: 'none' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center' }}><img src="/logo.png" alt="DonutDash" style={{ height: '60px', width: 'auto' }} /><sup style={{ fontSize: 11, fontWeight: 700, marginLeft: 1 }}>™</sup></span>
          </Link>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1A1A2E', marginTop: '1rem' }}>
            Set Up Your Shop
          </h1>
          <p style={{ color: '#888', fontSize: '0.9rem', marginTop: '0.35rem' }}>
            Welcome{user?.name ? `, ${user.name}` : ''}! Tell us about your donut shop.
          </p>
        </div>

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
              Shop Name *
            </label>
            <input type="text" value={shopName} onChange={e => setShopName(e.target.value)} required
              placeholder="e.g. Happy Donuts" style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')}
              onBlur={e => (e.currentTarget.style.borderColor = '#ddd')} />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: '0.35rem', color: '#1A1A2E' }}>
              Description
            </label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Tell customers about your shop..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' as const }}
              onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')}
              onBlur={e => (e.currentTarget.style.borderColor = '#ddd')} />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: '0.35rem', color: '#1A1A2E' }}>
              Street Address *
            </label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)} required
              placeholder="123 Main St" style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')}
              onBlur={e => (e.currentTarget.style.borderColor = '#ddd')} />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: '0.35rem', color: '#1A1A2E' }}>
              Country *
            </label>
            <select value={country} onChange={e => setCountry(e.target.value)} required
              style={{ ...inputStyle, background: 'white' }}>
              <option value="US">United States</option>
              <option value="CA">Canada</option>
              <option value="KH">Cambodia</option>
              <option value="TH">Thailand</option>
              <option value="VN">Vietnam</option>
              <option value="LA">Laos</option>
              <option value="MM">Myanmar</option>
              <option value="PH">Philippines</option>
              <option value="MY">Malaysia</option>
              <option value="SG">Singapore</option>
              <option value="ID">Indonesia</option>
              <option value="JP">Japan</option>
              <option value="KR">South Korea</option>
              <option value="CN">China</option>
              <option value="TW">Taiwan</option>
              <option value="IN">India</option>
              <option value="AU">Australia</option>
              <option value="NZ">New Zealand</option>
              <option value="GB">United Kingdom</option>
              <option value="FR">France</option>
              <option value="DE">Germany</option>
              <option value="MX">Mexico</option>
              <option value="BR">Brazil</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: '0.35rem', color: '#1A1A2E' }}>
                City *
              </label>
              <input type="text" value={city} onChange={e => setCity(e.target.value)} required
                placeholder="City" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')}
                onBlur={e => (e.currentTarget.style.borderColor = '#ddd')} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: '0.35rem', color: '#1A1A2E' }}>
                State / Province
              </label>
              <input type="text" value={state} onChange={e => setState(e.target.value)}
                placeholder="State or Province" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')}
                onBlur={e => (e.currentTarget.style.borderColor = '#ddd')} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: '0.35rem', color: '#1A1A2E' }}>
              ZIP / Postal Code
            </label>
            <input type="text" value={zip} onChange={e => setZip(e.target.value)}
              placeholder="Postal code" style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')}
              onBlur={e => (e.currentTarget.style.borderColor = '#ddd')} />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: '0.35rem', color: '#1A1A2E' }}>
              Shop Phone
            </label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="(555) 123-4567" style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')}
              onBlur={e => (e.currentTarget.style.borderColor = '#ddd')} />
          </div>

          {/* Shop Referral Code */}
          <div style={{ background: '#FFF0F5', borderRadius: 10, padding: 16, border: '1px dashed #FFD6EC' }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.35rem', color: '#FF1493' }}>
              Referral Code (optional)
            </label>
            <input type="text" value={shopReferralCode} onChange={e => setShopReferralCode(e.target.value)}
              placeholder="Enter referral code from another shop" style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#FF1493')}
              onBlur={e => (e.currentTarget.style.borderColor = '#ddd')} />
            <p style={{ fontSize: 11, color: '#888', marginTop: 4, marginBottom: 0 }}>
              Both you and the referring shop earn $100 after your first 20 completed orders!
            </p>
          </div>

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '0.85rem',
            background: loading ? '#ccc' : '#FF1493',
            color: 'white', border: 'none', borderRadius: '10px',
            fontSize: '1rem', fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s', marginTop: '0.5rem',
          }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#FF69B4' }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#FF1493' }}
          >
            {loading ? 'Creating Shop...' : 'Create My Shop'}
          </button>
        </form>
      </div>
    </div>
  )
}
