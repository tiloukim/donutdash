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

interface StripePayoutsData {
  connected: boolean
  message?: string
  error?: string
  shop?: { id: string; name: string }
  balance?: { available_usd: number; pending_usd: number; total_usd: number }
  bank?: { bank_name: string | null; last4: string | null; status: string | null } | null
  payout_schedule?: { interval?: string; weekly_anchor?: string; monthly_anchor?: number; delay_days?: number } | null
  payouts_enabled?: boolean
  recent_payouts?: Array<{
    id: string
    amount_usd: number
    status: string
    method: string
    arrival_date: string | null
    created: string
    description: string | null
  }>
  express_login_url?: string
}

export default function EarningsPage() {
  const [data, setData] = useState<EarningsData | null>(null)
  const [stripeData, setStripeData] = useState<StripePayoutsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/shop/earnings')
      .then(r => { if (!r.ok) throw new Error('Failed to load'); return r.json() })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
    // Independent fetch — Stripe API is slower, don't block earnings render
    fetch('/api/shop/stripe-payouts')
      .then(r => r.json())
      .then(setStripeData)
      .catch(() => {})
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

      {/* Stripe Payouts — live data from the shop's Connect account */}
      {stripeData?.connected && stripeData.balance && (
        <div style={{
          background: '#fff', borderRadius: 16, padding: '18px 20px', marginBottom: 20,
          border: '2px solid #DBEAFE',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E' }}>
              💳 Your Stripe Payouts
            </div>
            <a
              href={stripeData.express_login_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, color: '#635BFF', textDecoration: 'none', fontWeight: 600 }}
            >
              Open in Stripe ↗
            </a>
          </div>

          {/* Balance cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
            <div style={{ padding: 14, borderRadius: 10, background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#065F46', textTransform: 'uppercase', letterSpacing: 0.5 }}>Available now</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#065F46', marginTop: 4 }}>{fmt(stripeData.balance.available_usd)}</div>
              <div style={{ fontSize: 11, color: '#047857', marginTop: 2 }}>Ready to pay out to your bank</div>
            </div>
            <div style={{ padding: 14, borderRadius: 10, background: '#FEF3C7', border: '1px solid #FDE68A' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: 0.5 }}>Pending settlement</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#92400E', marginTop: 4 }}>{fmt(stripeData.balance.pending_usd)}</div>
              <div style={{ fontSize: 11, color: '#B45309', marginTop: 2 }}>Stripe holds 2–4 days then releases</div>
            </div>
          </div>

          {/* Bank + schedule */}
          {(stripeData.bank || stripeData.payout_schedule) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 16, fontSize: 13 }}>
              {stripeData.bank && (
                <div style={{ padding: 12, borderRadius: 8, background: '#F9FAFB' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Linked bank</div>
                  <div style={{ marginTop: 4, color: '#1A1A2E', fontWeight: 600 }}>
                    {stripeData.bank.bank_name ?? 'Bank account'}
                    {stripeData.bank.last4 && <span style={{ color: '#6B7280' }}> ••••{stripeData.bank.last4}</span>}
                  </div>
                  {stripeData.bank.status && stripeData.bank.status !== 'new' && stripeData.bank.status !== 'validated' && (
                    <div style={{ fontSize: 11, color: '#DC2626', marginTop: 2 }}>Status: {stripeData.bank.status}</div>
                  )}
                </div>
              )}
              {stripeData.payout_schedule && (
                <div style={{ padding: 12, borderRadius: 8, background: '#F9FAFB' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Payout schedule</div>
                  <div style={{ marginTop: 4, color: '#1A1A2E', fontWeight: 600 }}>
                    {stripeData.payout_schedule.interval === 'daily' && 'Every business day'}
                    {stripeData.payout_schedule.interval === 'weekly' && `Weekly · ${stripeData.payout_schedule.weekly_anchor ?? ''}`}
                    {stripeData.payout_schedule.interval === 'monthly' && `Monthly · day ${stripeData.payout_schedule.monthly_anchor}`}
                    {stripeData.payout_schedule.interval === 'manual' && 'Manual (you initiate)'}
                  </div>
                  {stripeData.payout_schedule.delay_days != null && (
                    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{stripeData.payout_schedule.delay_days}-day rolling hold</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Recent payouts list */}
          {stripeData.recent_payouts && stripeData.recent_payouts.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                Recent payouts to your bank
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {stripeData.recent_payouts.slice(0, 5).map(p => (
                  <div key={p.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px', borderRadius: 8, background: '#F9FAFB', fontSize: 13,
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#1A1A2E' }}>{fmt(p.amount_usd)}</div>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>
                        {p.arrival_date
                          ? `Arrives ${new Date(p.arrival_date).toLocaleDateString()}`
                          : `Created ${new Date(p.created).toLocaleDateString()}`}
                        {p.method && p.method !== 'standard' && ` · ${p.method}`}
                      </div>
                    </div>
                    <span style={{
                      padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: p.status === 'paid' ? '#ECFDF5' : p.status === 'in_transit' ? '#DBEAFE' : '#FEF3C7',
                      color: p.status === 'paid' ? '#065F46' : p.status === 'in_transit' ? '#1E40AF' : '#92400E',
                    }}>
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {stripeData.recent_payouts && stripeData.recent_payouts.length === 0 && (
            <div style={{ padding: 12, background: '#F9FAFB', borderRadius: 8, fontSize: 13, color: '#6B7280' }}>
              No payouts yet — your first payout takes a few extra days while Stripe verifies your account.
            </div>
          )}

          {stripeData.payouts_enabled === false && (
            <div style={{ marginTop: 12, padding: 10, background: '#FEE2E2', borderRadius: 8, fontSize: 13, color: '#991B1B' }}>
              ⚠ Payouts are currently disabled on your Stripe account. Check Stripe for any verification requests.
            </div>
          )}
        </div>
      )}
      {stripeData?.error && (
        <div style={{ padding: 12, background: '#FEF3C7', borderRadius: 8, fontSize: 12, color: '#92400E', marginBottom: 20 }}>
          Could not load Stripe payout data: {stripeData.error}
        </div>
      )}

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
