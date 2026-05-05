'use client'

import { useState, useEffect } from 'react'
import { SHOP_COMMISSION_RATE } from '@/lib/constants'

interface EarningsData {
  today: { sales: number; earnings: number; orderCount: number }
  thisWeek: { sales: number; earnings: number; orderCount: number }
  thisMonth: { sales: number; earnings: number; orderCount: number }
  nextPayout: number
  stripeConnected: boolean
  recentOrders: {
    id: string
    created_at: string
    status: string
    subtotal: number
    fee: number
    earnings: number
    item_count: number
  }[]
  weeklyTotals: { weekLabel: string; total: number; earnings: number }[]
}

function fmt(n: number) {
  return '$' + n.toFixed(2)
}

function shortDate(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function statusBadge(status: string) {
  const paid = ['delivered', 'completed'].includes(status)
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 700,
      background: paid ? '#ECFDF5' : '#FEF9C3',
      color: paid ? '#065F46' : '#92400E',
    }}>
      {paid ? 'Paid' : 'Pending'}
    </span>
  )
}

export default function EarningsPage() {
  const [data, setData] = useState<EarningsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/shop/earnings')
      .then(r => { if (!r.ok) throw new Error('Failed to load'); return r.json() })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300, fontSize: 16, color: '#888' }}>
        Loading your earnings...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#DC2626' }}>
        {error || 'Could not load earnings. Please try again.'}
      </div>
    )
  }

  const maxWeekly = Math.max(...data.weeklyTotals.map(w => w.earnings), 1)

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        {/* Today */}
        <div style={{
          background: 'linear-gradient(135deg, #FF1493, #FF69B4)',
          borderRadius: 16, padding: '20px 18px', color: '#fff',
          boxShadow: '0 4px 14px rgba(255,20,147,0.25)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.9, marginBottom: 4 }}>Today&apos;s Sales</div>
          <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.1 }}>{fmt(data.today.earnings)}</div>
          <div style={{ fontSize: 12, marginTop: 6, opacity: 0.85 }}>
            {data.today.orderCount} order{data.today.orderCount !== 1 ? 's' : ''} &middot; {fmt(data.today.sales)} total
          </div>
        </div>

        {/* This Week */}
        <div style={{
          background: '#fff', borderRadius: 16, padding: '20px 18px',
          border: '2px solid #FFE4EF',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#888', marginBottom: 4 }}>This Week</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#1A1A2E' }}>{fmt(data.thisWeek.earnings)}</div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
            You earned from {data.thisWeek.orderCount} orders
          </div>
        </div>

        {/* This Month */}
        <div style={{
          background: '#fff', borderRadius: 16, padding: '20px 18px',
          border: '2px solid #FFE4EF',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#888', marginBottom: 4 }}>This Month</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#1A1A2E' }}>{fmt(data.thisMonth.earnings)}</div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
            You earned from {data.thisMonth.orderCount} orders
          </div>
        </div>
      </div>

      {/* Next Payout */}
      <div style={{
        background: '#fff', borderRadius: 16, padding: '18px 20px', marginBottom: 20,
        border: '2px solid #D1FAE5',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#888', marginBottom: 2 }}>Your Next Payout</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: '#065F46' }}>{fmt(data.nextPayout)}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Arrives in ~2 business days via Stripe</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {data.stripeConnected ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 20 }}>&#x2705;</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#065F46' }}>Stripe Connected</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 20 }}>&#x26A0;&#xFE0F;</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#92400E' }}>Connect Stripe to get paid</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Weekly Chart */}
      <div style={{
        background: '#fff', borderRadius: 16, padding: '18px 20px', marginBottom: 20,
        border: '1px solid #FFE4EF',
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E', marginBottom: 14 }}>Last 4 Weeks</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 120 }}>
          {data.weeklyTotals.map((w, i) => {
            const pct = (w.earnings / maxWeekly) * 100
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#FF1493' }}>{fmt(w.earnings)}</div>
                <div style={{
                  width: '100%', maxWidth: 48,
                  height: `${Math.max(pct, 5)}%`,
                  background: 'linear-gradient(to top, #FF1493, #FF69B4)',
                  borderRadius: '6px 6px 0 0',
                  transition: 'height 0.5s ease',
                }} />
                <div style={{ fontSize: 11, color: '#888', fontWeight: 600 }}>Wk {w.weekLabel}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent Orders */}
      <div style={{
        background: '#fff', borderRadius: 16, padding: '18px 20px',
        border: '1px solid #FFE4EF',
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E', marginBottom: 14 }}>Recent Orders</div>

        {data.recentOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: '#999', fontSize: 14 }}>
            No orders yet. They&apos;ll show up here!
          </div>
        ) : (
          <div>
            {data.recentOrders.map(order => (
              <div key={order.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 0',
                borderBottom: '1px solid #f5f5f5',
                flexWrap: 'wrap',
              }}>
                {/* Left: date + order # */}
                <div style={{ flex: '1 1 120px', minWidth: 100 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E' }}>#{order.id.slice(0, 8)}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{shortDate(order.created_at)} &middot; {order.item_count} item{order.item_count !== 1 ? 's' : ''}</div>
                </div>

                {/* Middle: amounts */}
                <div style={{ flex: '1 1 140px', minWidth: 120 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#065F46' }}>You Earn {fmt(order.earnings)}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>
                    {fmt(order.subtotal)} sale - {fmt(order.fee)} DonutDash fee
                  </div>
                </div>

                {/* Right: status */}
                <div style={{ flexShrink: 0 }}>
                  {statusBadge(order.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fee explainer */}
      <div style={{
        textAlign: 'center', padding: '16px 20px', marginTop: 16,
        fontSize: 12, color: '#999', lineHeight: 1.5,
      }}>
        DonutDash fee is taken from each order&apos;s subtotal at the rate on your merchant agreement (default {(SHOP_COMMISSION_RATE * 100).toFixed(0)}%). This covers payment processing, customer support, and the platform.
      </div>
    </div>
  )
}
