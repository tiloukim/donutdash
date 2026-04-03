'use client'

import { useState, useEffect } from 'react'

export default function ShopReferralPage() {
  const [referral, setReferral] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/shop/referral')
      .then(r => r.json())
      .then(setReferral)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading...</div>

  const code = referral?.referral_code || ''
  const myRef = referral?.my_referral

  return (
    <div style={{ maxWidth: 600 }}>
      {/* Hero Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #FF1493 0%, #FF69B4 50%, #FF8C00 100%)',
        borderRadius: 20, padding: '32px 28px', marginBottom: 24, color: '#fff',
      }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🎁</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 8px 0' }}>Refer a Shop, Earn $100!</h1>
        <p style={{ fontSize: 15, opacity: 0.9, margin: '0 0 24px 0', lineHeight: 1.5 }}>
          Share your referral code with another donut shop owner. When they join DonutDash and complete 20 orders, you both earn $100 credit!
        </p>

        <div style={{
          background: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: '16px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)',
        }}>
          <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: 4 }}>{code}</span>
          <button onClick={() => {
            navigator.clipboard.writeText(code)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }} style={{
            padding: '10px 24px', borderRadius: 10, border: '2px solid rgba(255,255,255,0.4)',
            background: copied ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
            color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
          }}>
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
        </div>
      </div>

      {/* How it Works */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #FFE4EF', padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px 0', color: '#1A1A2E' }}>How It Works</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { step: '1', title: 'Share Your Code', desc: 'Give your referral code to another donut shop owner' },
            { step: '2', title: 'They Join DonutDash', desc: 'They enter your code when setting up their shop' },
            { step: '3', title: 'They Complete 20 Orders', desc: 'Once their shop delivers 20 orders...' },
            { step: '4', title: 'You Both Earn $100!', desc: 'Both you and the new shop get $100 credit' },
          ].map(s => (
            <div key={s.step} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', background: '#FF1493', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 16, flexShrink: 0,
              }}>{s.step}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#1A1A2E' }}>{s.title}</div>
                <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #FFE4EF', padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#FF1493' }}>{referral?.completed_count || 0}</div>
          <div style={{ fontSize: 13, color: '#888' }}>Shops Referred</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #FFE4EF', padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#10B981' }}>${referral?.total_earned || 0}</div>
          <div style={{ fontSize: 13, color: '#888' }}>Total Earned</div>
        </div>
      </div>

      {/* My Referral Progress (if referred by someone) */}
      {myRef && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #FFE4EF', padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 12px 0', color: '#1A1A2E' }}>Your Referral Bonus Progress</h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>
              {myRef.orders_completed} / {myRef.orders_required} orders
            </span>
            <span style={{
              fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 8,
              background: myRef.status === 'completed' ? '#D1FAE5' : '#FEF3C7',
              color: myRef.status === 'completed' ? '#065F46' : '#92400E',
            }}>
              {myRef.status === 'completed' ? '$100 Earned!' : `${myRef.orders_required - myRef.orders_completed} to go`}
            </span>
          </div>
          <div style={{ background: '#F3F4F6', borderRadius: 10, height: 12, overflow: 'hidden' }}>
            <div style={{
              background: myRef.status === 'completed' ? '#10B981' : 'linear-gradient(90deg, #FF1493, #FF8C00)',
              height: '100%',
              width: `${Math.min(100, (myRef.orders_completed / myRef.orders_required) * 100)}%`,
              borderRadius: 10,
              transition: 'width 0.5s',
            }} />
          </div>
        </div>
      )}

      {/* Referred Shops List */}
      {referral?.referrals?.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #FFE4EF', padding: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px 0', color: '#1A1A2E' }}>Your Referrals</h2>
          {referral.referrals.map((r: any) => (
            <div key={r.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 0', borderBottom: '1px solid #f5f5f5',
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{r.orders_completed}/{r.orders_required} orders</div>
                <div style={{ fontSize: 12, color: '#888' }}>Referred {new Date(r.created_at).toLocaleDateString()}</div>
              </div>
              <span style={{
                fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 8,
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
