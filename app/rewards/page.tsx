'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import Navbar from '@/components/Navbar'
import Link from 'next/link'

interface Transaction {
  id: string
  points: number
  type: string
  description: string
  created_at: string
}

interface LoyaltyData {
  points: number
  lifetime_points: number
  tier: string
  transactions: Transaction[]
}

const TIERS = [
  { name: 'bronze', min: 0, max: 499, color: '#CD7F32', next: 'silver', nextAt: 500 },
  { name: 'silver', min: 500, max: 1499, color: '#C0C0C0', next: 'gold', nextAt: 1500 },
  { name: 'gold', min: 1500, max: 4999, color: '#FFD700', next: 'platinum', nextAt: 5000 },
  { name: 'platinum', min: 5000, max: Infinity, color: '#E5E4E2', next: null, nextAt: null },
]

const TIER_BENEFITS: Record<string, string[]> = {
  bronze: ['Earn 1 point per $1 spent', 'Redeem points for rewards'],
  silver: ['Everything in Bronze', 'Bonus points on weekends (coming soon)'],
  gold: ['Everything in Silver', 'Priority order processing (coming soon)'],
  platinum: ['Everything in Gold', 'Exclusive monthly offers (coming soon)'],
}

export default function RewardsPage() {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState<LoyaltyData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) { setLoading(false); return }
    fetch('/api/loyalty')
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [user, authLoading])

  const currentTier = TIERS.find(t => t.name === (data?.tier || 'bronze'))!
  const progress = currentTier.next && currentTier.nextAt
    ? Math.min(100, ((data?.lifetime_points || 0) - currentTier.min) / (currentTier.nextAt - currentTier.min) * 100)
    : 100

  if (authLoading || loading) {
    return (
      <>
        <Navbar />
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '1.1rem', color: '#888' }}>Loading...</div>
        </div>
      </>
    )
  }

  if (!user) {
    return (
      <>
        <Navbar />
        <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎁</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Sign in to view your rewards</h2>
          <p style={{ color: '#888', marginBottom: '1.5rem' }}>Earn points on every order and redeem for free delivery and discounts!</p>
          <Link href="/login" style={{
            background: '#FF8C00', color: 'white', padding: '0.75rem 2rem',
            borderRadius: '10px', fontWeight: 600, fontSize: '1rem', textDecoration: 'none',
          }}>Sign In</Link>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem 1rem', paddingTop: '140px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#1A1A2E', margin: 0 }}>
            DonutDash™ Rewards
          </h1>
          <p style={{ color: '#888', marginTop: '0.25rem' }}>Earn points. Get treats.</p>
        </div>

        {/* Points & Tier Card */}
        <div style={{
          background: 'linear-gradient(135deg, #FF8C00, #FFB347)',
          borderRadius: '20px',
          padding: '2rem',
          color: 'white',
          marginBottom: '1.5rem',
          boxShadow: '0 8px 32px rgba(255,140,0,0.3)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.85rem', opacity: 0.9, fontWeight: 500 }}>Available Points</div>
              <div style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1.1 }}>{data?.points || 0}</div>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.25)',
              borderRadius: '12px',
              padding: '0.5rem 1rem',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.9 }}>Tier</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, textTransform: 'capitalize' }}>{data?.tier || 'bronze'}</div>
            </div>
          </div>

          {/* Progress bar to next tier */}
          {currentTier.next && (
            <div style={{ marginTop: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', opacity: 0.9, marginBottom: '6px' }}>
                <span style={{ textTransform: 'capitalize' }}>{currentTier.name}</span>
                <span style={{ textTransform: 'capitalize' }}>{currentTier.next} ({currentTier.nextAt} pts)</span>
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.3)',
                borderRadius: '10px',
                height: '10px',
                overflow: 'hidden',
              }}>
                <div style={{
                  background: 'white',
                  height: '100%',
                  borderRadius: '10px',
                  width: `${progress}%`,
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: '4px' }}>
                {(currentTier.nextAt! - (data?.lifetime_points || 0))} points to {currentTier.next}
              </div>
            </div>
          )}
          {!currentTier.next && (
            <div style={{ marginTop: '1rem', fontSize: '0.85rem', opacity: 0.9 }}>
              You have reached the highest tier!
            </div>
          )}
        </div>

        {/* Tier Benefits */}
        <div style={{
          background: '#FFF8F0',
          border: '1px solid #FFE8D6',
          borderRadius: '16px',
          padding: '1.25rem',
          marginBottom: '1.5rem',
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.75rem', color: '#1A1A2E' }}>
            <span style={{ textTransform: 'capitalize' }}>{data?.tier || 'bronze'}</span> Tier Benefits
          </h3>
          {TIER_BENEFITS[data?.tier || 'bronze'].map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: '#555', marginBottom: '6px' }}>
              <span style={{ color: '#FF8C00', fontWeight: 700 }}>+</span> {b}
            </div>
          ))}
        </div>

        {/* Redeem Section — disabled while promo application is being rewired.
            Points still accrue; redemption returns once promos are re-enabled. */}
        <div style={{
          background: '#FFF8F0',
          border: '1px dashed #FFD8A8',
          borderRadius: '16px',
          padding: '1.25rem',
          marginBottom: '2rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎁</div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1A1A2E', marginBottom: '0.25rem' }}>
            Rewards coming soon
          </div>
          <div style={{ fontSize: '0.85rem', color: '#666', lineHeight: 1.5 }}>
            Keep earning points on every order — redemption will be available shortly.
          </div>
        </div>

        {/* Transaction History */}
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1A1A2E', marginBottom: '1rem' }}>
          Points History
        </h2>

        {(!data?.transactions || data.transactions.length === 0) ? (
          <div style={{
            textAlign: 'center',
            padding: '2rem',
            color: '#888',
            background: '#FAFAFA',
            borderRadius: '12px',
          }}>
            No transactions yet. Place an order to start earning points!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.transactions.map(tx => (
              <div key={tx.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 1rem',
                background: 'white',
                border: '1px solid #F0F0F0',
                borderRadius: '10px',
              }}>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 500, color: '#1A1A2E' }}>
                    {tx.description || tx.type}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#AAA' }}>
                    {new Date(tx.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </div>
                </div>
                <div style={{
                  fontWeight: 700,
                  fontSize: '1rem',
                  color: tx.points > 0 ? '#38A169' : '#E53E3E',
                }}>
                  {tx.points > 0 ? '+' : ''}{tx.points}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
