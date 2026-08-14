'use client'

import { useState, useEffect } from 'react'
import { SHOP_COMMISSION_RATE } from '@/lib/constants'

interface EarningsData {
  today: { sales: number; earnings: number; orderCount: number }
  thisWeek: { sales: number; earnings: number; orderCount: number }
  thisMonth: { sales: number; earnings: number; orderCount: number }
  nextPayout: number
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

interface OrderBreakdown {
  order: { id: string; short_code: string | null; status: string; order_type: string; created_at: string; shop_name: string | null }
  customer: {
    paid: number
    composition: { subtotal: number; tax: number; delivery_fee: number; service_fee: number; tip: number; promo_discount: number }
  }
  shop: {
    gross: number
    commission: number
    commission_rate_pct: number
    effective_payout: number
    effective_commission: number
    refund_amount: number
    refund_ratio_pct: number
  }
  platform?: {
    application_fee: number
    platform_gross: number
    effective_delivery_fee: number
    effective_service_fee: number
    effective_tip: number
    effective_tax: number
  }
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
  const [breakdown, setBreakdown] = useState<OrderBreakdown | null>(null)
  const [breakdownLoading, setBreakdownLoading] = useState(false)
  const [breakdownError, setBreakdownError] = useState('')

  function openBreakdown(orderId: string) {
    setBreakdown(null)
    setBreakdownError('')
    setBreakdownLoading(true)
    fetch(`/api/shop/orders/${orderId}/breakdown`)
      .then(async r => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error || 'Failed to load breakdown')
        return json as OrderBreakdown
      })
      .then(setBreakdown)
      .catch(e => setBreakdownError(e.message))
      .finally(() => setBreakdownLoading(false))
  }
  function closeBreakdown() {
    setBreakdown(null)
    setBreakdownError('')
    setBreakdownLoading(false)
  }

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

      {/* Next Payout — order-based. DonutDash collects payments via Square and
          pays each shop's earnings to the bank account on file. */}
      <div style={{
        background: '#fff', borderRadius: 16, padding: '18px 20px', marginBottom: 20,
        border: '2px solid #D1FAE5',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#888', marginBottom: 2 }}>Your Next Payout</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: '#065F46' }}>{fmt(data.nextPayout)}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
            {data.nextPayout > 0
              ? 'Paid to the bank account on file in Settings'
              : 'No payout in flight — new sales will show up here'}
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
              <div
                key={order.id}
                onClick={() => openBreakdown(order.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 8px',
                  borderBottom: '1px solid #f5f5f5',
                  flexWrap: 'wrap',
                  cursor: 'pointer',
                  borderRadius: 8,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#FAFAFA' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
              >
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

      {/* Breakdown modal — opens when a Recent Orders row is clicked. */}
      {(breakdown || breakdownLoading || breakdownError) && (
        <div
          onClick={closeBreakdown}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16, zIndex: 50,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 16, padding: '20px 22px',
              maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1A1A2E' }}>Payment Breakdown</div>
              <button
                onClick={closeBreakdown}
                style={{ background: 'none', border: 'none', fontSize: 22, color: '#888', cursor: 'pointer', lineHeight: 1, padding: 4 }}
                aria-label="Close"
              >×</button>
            </div>

            {breakdownLoading && (
              <div style={{ padding: 30, textAlign: 'center', color: '#888', fontSize: 14 }}>Loading...</div>
            )}
            {breakdownError && (
              <div style={{ padding: 16, background: '#FEE2E2', borderRadius: 8, color: '#991B1B', fontSize: 13 }}>
                {breakdownError}
              </div>
            )}

            {breakdown && (() => {
              const b = breakdown
              const Row = ({ label, amount, sub, bold, color, indent }: { label: string; amount: number | string; sub?: string; bold?: boolean; color?: string; indent?: boolean }) => (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0', paddingLeft: indent ? 12 : 0 }}>
                  <div>
                    <div style={{ fontSize: bold ? 14 : 13, fontWeight: bold ? 700 : 500, color: color || '#1A1A2E' }}>{label}</div>
                    {sub && <div style={{ fontSize: 11, color: '#999' }}>{sub}</div>}
                  </div>
                  <div style={{ fontSize: bold ? 14 : 13, fontWeight: bold ? 800 : 600, color: color || '#1A1A2E' }}>
                    {typeof amount === 'number' ? fmt(amount) : amount}
                  </div>
                </div>
              )
              return (
                <div>
                  {/* Order header */}
                  <div style={{ padding: '10px 12px', background: '#FFF7FB', borderRadius: 10, marginBottom: 14, fontSize: 12, color: '#6B6B7B' }}>
                    {b.order.short_code && <div><strong style={{ color: '#1A1A2E' }}>#{b.order.short_code}</strong> · {b.order.order_type}</div>}
                    <div>{new Date(b.order.created_at).toLocaleString()}</div>
                  </div>

                  {/* Food sale — the amount the shop's commission is based on.
                      Delivery/service/tax/tip/promo aren't the shop's money, so
                      they're intentionally not shown in the shop's breakdown. */}
                  <div style={{ borderTop: '1px solid #F0F0F0', paddingTop: 10 }}>
                    <Row label="Order total (food)" amount={b.customer.composition.subtotal} bold />
                  </div>

                  {/* Shop slice */}
                  <div style={{ borderTop: '1px solid #F0F0F0', marginTop: 10, paddingTop: 10 }}>
                    <Row
                      label="Shop receives"
                      amount={b.shop.effective_payout}
                      sub={`Subtotal − ${b.shop.commission_rate_pct}% commission`}
                      bold
                      color="#065F46"
                    />
                    <Row label="DonutDash commission" amount={-b.shop.effective_commission} indent color="#92400E" />
                    {b.shop.refund_amount > 0 && (
                      <Row label={`Refund (${b.shop.refund_ratio_pct}%)`} amount={-b.shop.refund_amount} indent color="#991B1B" />
                    )}
                  </div>

                  {/* Platform slice — admin only */}
                  {b.platform && (
                    <div style={{ borderTop: '1px solid #F0F0F0', marginTop: 10, paddingTop: 10, background: '#FAFAFE', margin: '10px -8px 0', padding: '12px 8px', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                        Platform (admin view)
                      </div>
                      <Row label="Application fee (gross)" amount={b.platform.application_fee} sub="Customer total − shop transfer" />
                      <Row label="Platform net" amount={b.platform.platform_gross} bold color="#1E40AF" />
                      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 8, lineHeight: 1.5 }}>
                        Of this, ${b.platform.effective_delivery_fee.toFixed(2)} delivery + ${b.platform.effective_service_fee.toFixed(2)} service + ${b.platform.effective_tip.toFixed(2)} tip + ${b.platform.effective_tax.toFixed(2)} tax fund driver pay, tax remittance, and platform ops.
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
