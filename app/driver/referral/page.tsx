'use client'

import { useState, useEffect } from 'react'

export default function DriverReferralPage() {
  const [referral, setReferral] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [applyCode, setApplyCode] = useState('')
  const [applying, setApplying] = useState(false)
  const [applyMsg, setApplyMsg] = useState('')
  const [applyError, setApplyError] = useState('')

  useEffect(() => {
    fetch('/api/driver/referral')
      .then(r => r.json())
      .then(setReferral)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleApplyCode = async () => {
    if (!applyCode.trim()) return
    setApplying(true); setApplyMsg(''); setApplyError('')
    try {
      const res = await fetch('/api/driver/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referral_code: applyCode.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setApplyMsg(data.message || 'Referral applied!')
        setApplyCode('')
      } else {
        setApplyError(data.error || 'Failed to apply')
      }
    } catch { setApplyError('Failed to apply') }
    finally { setApplying(false) }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading...</div>

  const code = referral?.referral_code || ''

  return (
    <div>
      {/* Hero Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #FF8C00 0%, #FFA940 50%, #10B981 100%)',
        borderRadius: 20, padding: '28px 24px', marginBottom: 24, color: '#fff',
      }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px 0' }}>Earn with Referrals!</h1>
        <p style={{ fontSize: 14, opacity: 0.9, margin: '0 0 20px 0', lineHeight: 1.5 }}>
          Share your code with other drivers or shop owners and earn rewards!
        </p>
        <div style={{
          background: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: '14px 18px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)',
        }}>
          <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: 3 }}>{code}</span>
          <button onClick={() => {
            navigator.clipboard.writeText(code)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }} style={{
            padding: '8px 20px', borderRadius: 10, border: '2px solid rgba(255,255,255,0.4)',
            background: copied ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
            color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>${referral?.total_earned || 0}</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Total Earned</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{referral?.driver_completed || 0}</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Drivers Referred</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{referral?.shop_completed || 0}</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Shops Referred</div>
          </div>
        </div>
      </div>

      {/* Apply a referral code */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #FFE8D6', padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px 0' }}>Have a Referral Code?</h2>
        <p style={{ fontSize: 13, color: '#888', margin: '0 0 12px 0' }}>Enter a code from another driver to earn $20 each after your first 10 deliveries.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={applyCode} onChange={e => setApplyCode(e.target.value)} placeholder="Enter code"
            style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, outline: 'none' }} />
          <button onClick={handleApplyCode} disabled={applying}
            style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#FF8C00', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            {applying ? '...' : 'Apply'}
          </button>
        </div>
        {applyMsg && <div style={{ marginTop: 8, fontSize: 13, color: '#10B981' }}>{applyMsg}</div>}
        {applyError && <div style={{ marginTop: 8, fontSize: 13, color: '#DC2626' }}>{applyError}</div>}
      </div>

      {/* Driver-to-Driver Referral */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #FFE8D6', padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 28 }}>🚗</span>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Refer a Driver — $20 Each</h2>
            <p style={{ fontSize: 12, color: '#888', margin: '2px 0 0 0' }}>Both earn $20 after the new driver completes 10 deliveries</p>
          </div>
        </div>
        {referral?.driver_referrals?.length > 0 ? (
          referral.driver_referrals.map((r: any) => (
            <div key={r.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 0', borderBottom: '1px solid #f5f5f5',
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{(r.referee as any)?.name || 'Driver'}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{r.deliveries_completed || 0}/10 deliveries</div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6,
                background: r.status === 'completed' ? '#D1FAE5' : '#FEF3C7',
                color: r.status === 'completed' ? '#065F46' : '#92400E',
              }}>
                {r.status === 'completed' ? '$20 Earned!' : 'In Progress'}
              </span>
            </div>
          ))
        ) : (
          <div style={{ color: '#888', fontSize: 13, textAlign: 'center', padding: 16 }}>No driver referrals yet. Share your code!</div>
        )}
      </div>

      {/* Shop Referral */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #FFE8D6', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 28 }}>🏪</span>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Refer a Shop — $100 Each</h2>
            <p style={{ fontSize: 12, color: '#888', margin: '2px 0 0 0' }}>Both earn $100 after the new shop completes 20 orders</p>
          </div>
        </div>
        {referral?.shop_referrals?.length > 0 ? (
          referral.shop_referrals.map((r: any) => (
            <div key={r.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 0', borderBottom: '1px solid #f5f5f5',
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{(r.shop as any)?.name || 'New Shop'}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{r.orders_completed}/{r.orders_required} orders</div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6,
                background: r.status === 'completed' ? '#D1FAE5' : '#FEF3C7',
                color: r.status === 'completed' ? '#065F46' : '#92400E',
              }}>
                {r.status === 'completed' ? '$100 Earned!' : 'In Progress'}
              </span>
            </div>
          ))
        ) : (
          <div style={{ color: '#888', fontSize: 13, textAlign: 'center', padding: 16 }}>No shop referrals yet. Talk to local shop owners!</div>
        )}
      </div>
    </div>
  )
}
