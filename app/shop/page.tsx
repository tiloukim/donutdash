'use client'

import { useState, useEffect } from 'react'
import { SHOP_COMMISSION_RATE } from '@/lib/constants'

type PeriodStats = {
  orderCount: number
  totalSales: number
  commission: number
  shopEarnings: number
}

type StatsData = {
  today: PeriodStats
  thisWeek: PeriodStats
  thisMonth: PeriodStats
  allTime: PeriodStats
  pendingOrders: number
  recentOrders: any[]
}

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'thisWeek', label: 'This Week' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'allTime', label: 'All Time' },
] as const

type PeriodKey = typeof PERIODS[number]['key']

export default function ShopDashboard() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activePeriod, setActivePeriod] = useState<PeriodKey>('today')
  const [referral, setReferral] = useState<any>(null)
  const [refCopied, setRefCopied] = useState(false)

  useEffect(() => {
    fetch('/api/shop/stats')
      .then(r => r.json())
      .then(data => {
        if (data.today) setStats(data)
      })
      .finally(() => setLoading(false))
    fetch('/api/shop/referral').then(r => r.json()).then(setReferral).catch(() => {})
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300, color: '#888' }}>
      Loading dashboard...
    </div>
  )

  if (!stats) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300, color: '#888' }}>
      Failed to load dashboard data.
    </div>
  )

  const period = stats[activePeriod]

  const cards = [
    { label: 'Total Sales', value: `$${period.totalSales.toFixed(2)}`, color: '#FF1493', icon: '💰' },
    { label: `Your Earnings (${((1 - SHOP_COMMISSION_RATE) * 100).toFixed(0)}%)`, value: `$${period.shopEarnings.toFixed(2)}`, color: '#10B981', icon: '✅' },
    { label: `Commission Paid (${(SHOP_COMMISSION_RATE * 100).toFixed(0)}%)`, value: `$${period.commission.toFixed(2)}`, color: '#FF8C00', icon: '🏷️' },
    { label: 'Orders', value: period.orderCount, color: '#6366F1', icon: '📦' },
  ]

  return (
    <div>
      {/* Referral Banner */}
      {referral?.referral_code && (
        <div style={{
          background: 'linear-gradient(135deg, #FF1493 0%, #FF69B4 50%, #FF8C00 100%)',
          borderRadius: 12, padding: '14px 16px', marginBottom: 16,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 2 }}>
              Refer a Shop, Earn $100!
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>
              Share your code — both earn $100 after 20 orders
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 12px',
              fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: 2, backdropFilter: 'blur(4px)',
            }}>
              {referral.referral_code}
            </div>
            <button onClick={() => {
              navigator.clipboard.writeText(referral.referral_code)
              setRefCopied(true)
              setTimeout(() => setRefCopied(false), 2000)
            }} style={{
              padding: '6px 14px', borderRadius: 8, border: '2px solid rgba(255,255,255,0.4)',
              background: refCopied ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)',
              color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              {refCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          {(referral.completed_count > 0 || referral.my_referral) && (
            <div style={{ width: '100%', display: 'flex', gap: 20, marginTop: 4 }}>
              {referral.completed_count > 0 && (
                <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>
                  <span style={{ fontWeight: 800, fontSize: 18 }}>{referral.completed_count}</span> shops referred — <span style={{ fontWeight: 800 }}>${referral.total_earned}</span> earned
                </div>
              )}
              {referral.my_referral && referral.my_referral.status === 'pending' && (
                <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>
                  Your bonus: <span style={{ fontWeight: 800 }}>{referral.my_referral.orders_completed}/{referral.my_referral.orders_required}</span> orders completed
                </div>
              )}
              {referral.my_referral && referral.my_referral.status === 'completed' && (
                <div style={{ color: '#FBBF24', fontSize: 13, fontWeight: 700 }}>
                  $100 referral bonus earned!
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Period Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, background: '#FFF0F5', borderRadius: 10, padding: 3, border: '1px solid #FFE4EF' }}>
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setActivePeriod(p.key)}
            style={{
              flex: 1,
              padding: '8px 4px',
              border: 'none',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: activePeriod === p.key ? '#FF1493' : 'transparent',
              color: activePeriod === p.key ? '#fff' : '#888',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: '#fff', borderRadius: 10, padding: '14px 12px', border: '1px solid #FFE4EF' }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{c.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Pending Orders Banner */}
      {stats.pendingOrders > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #FFF0F5, #FFE4EF)',
          borderRadius: 12,
          padding: '14px 20px',
          marginBottom: 24,
          border: '1px solid #FF1493',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{ fontSize: 22 }}>⏳</span>
          <span style={{ fontWeight: 700, color: '#FF1493' }}>
            {stats.pendingOrders} pending order{stats.pendingOrders !== 1 ? 's' : ''} need{stats.pendingOrders === 1 ? 's' : ''} attention
          </span>
        </div>
      )}

      {/* Recent Orders Table */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #FFE4EF', overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #FFE4EF' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Recent Orders</h3>
        </div>
        {stats.recentOrders.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#888', fontSize: 13 }}>No orders yet</div>
        ) : (
          <div>
            {stats.recentOrders.map((o: any) => (
              <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #FFF0F5', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: '#FF1493', fontSize: 13 }}>#{o.id.slice(0, 8)}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: o.status === 'delivered' ? '#D1FAE5' : o.status === 'pending' ? '#FEF3C7' : '#E0E7FF', color: o.status === 'delivered' ? '#065F46' : o.status === 'pending' ? '#92400E' : '#3730A3' }}>
                      {o.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                    {o.customer?.name || 'Customer'} · {new Date(o.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#10B981' }}>${((o.subtotal || o.total) * (1 - SHOP_COMMISSION_RATE)).toFixed(2)}</div>
                  <div style={{ fontSize: 10, color: '#888' }}>${(o.subtotal || o.total).toFixed(2)} total</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
