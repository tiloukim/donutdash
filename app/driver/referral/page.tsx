'use client'

import { useState, useEffect } from 'react'

export default function DriverReferralPage() {
  const [referral, setReferral] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/driver/referral')
      .then(r => r.json())
      .then(setReferral)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading...</div>

  const code = referral?.referral_code || ''

  return (
    <div>
      {/* Hero Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #FF8C00 0%, #FFA940 50%, #10B981 100%)',
        borderRadius: 20, padding: '28px 24px', marginBottom: 24, color: '#fff',
      }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>💰</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px 0' }}>Refer a Shop, Earn $100!</h1>
        <p style={{ fontSize: 14, opacity: 0.9, margin: '0 0 20px 0', lineHeight: 1.5 }}>
          Know a donut shop that should be on DonutDash? Share your code with the owner. When their shop completes 20 orders, you earn $100!
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
      </div>

      {/* How it Works */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #FFE8D6', padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px 0' }}>How It Works</h2>
        {[
          { step: '1', title: 'Share your code with a shop owner', icon: '🗣️' },
          { step: '2', title: 'They sign up and enter your code', icon: '📱' },
          { step: '3', title: 'Their shop completes 20 deliveries', icon: '🍩' },
          { step: '4', title: 'You get $100 credit!', icon: '💵' },
        ].map(s => (
          <div key={s.step} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
            <span style={{ fontSize: 24 }}>{s.icon}</span>
            <span style={{ fontSize: 14, color: '#333' }}><strong>Step {s.step}:</strong> {s.title}</span>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #FFE8D6', padding: 18, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#FF8C00' }}>{referral?.completed_count || 0}</div>
          <div style={{ fontSize: 12, color: '#888' }}>Shops Referred</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #FFE8D6', padding: 18, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#10B981' }}>${referral?.total_earned || 0}</div>
          <div style={{ fontSize: 12, color: '#888' }}>Total Earned</div>
        </div>
      </div>

      {/* Referral List */}
      {referral?.referrals?.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #FFE8D6', padding: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px 0' }}>Your Referrals</h2>
          {referral.referrals.map((r: any) => (
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
          ))}
        </div>
      )}
    </div>
  )
}
