'use client'

import { useEffect, useState } from 'react'
import { SHOP_COMMISSION_RATE } from '@/lib/constants'

interface Stats {
  totalRevenue: number
  netProfit: number
  shopCommissions: number
  totalServiceFees: number
  totalDeliveryFees: number
  driverPayouts: number
  totalTips: number
  heldForShops: number
  heldForDrivers: number
  heldForTax: number
  totalOrders: number
  activeShops: number
  activeDrivers: number
  totalUsers: number
}

function fmt(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(data => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>Loading stats...</div>
  }

  const financialCards = [
    { label: 'Total Revenue', value: fmt(stats?.totalRevenue || 0), color: '#10B981', icon: '💰', description: 'Sum of all order totals' },
    { label: 'Net Profit', value: fmt(stats?.netProfit || 0), color: '#6366F1', icon: '📈', description: 'Commissions + fees - driver payouts' },
    { label: 'Shop Commissions', value: fmt(stats?.shopCommissions || 0), color: '#8B5CF6', icon: '🏷️', description: `Default ${(SHOP_COMMISSION_RATE * 100).toFixed(0)}%, per-shop overrides applied` },
    { label: 'Service Fees', value: fmt(stats?.totalServiceFees || 0), color: '#06B6D4', icon: '🧾', description: 'Collected from customers' },
    { label: 'Delivery Fees', value: fmt(stats?.totalDeliveryFees || 0), color: '#F59E0B', icon: '🚚', description: 'Charged per delivery' },
    { label: 'Driver Payouts', value: fmt(stats?.driverPayouts || 0), color: '#EF4444', icon: '💸', description: 'Paid to drivers' },
    { label: 'Tips', value: fmt(stats?.totalTips || 0), color: '#EC4899', icon: '🤑', description: 'Passed through to drivers' },
  ]

  const operationalCards = [
    { label: 'Total Orders', value: String(stats?.totalOrders || 0), color: '#6366F1', icon: '📦' },
    { label: 'Active Shops', value: String(stats?.activeShops || 0), color: '#F59E0B', icon: '🏪' },
    { label: 'Active Drivers', value: String(stats?.activeDrivers || 0), color: '#3B82F6', icon: '🚗' },
    { label: 'Total Users', value: String(stats?.totalUsers || 0), color: '#EC4899', icon: '👥' },
  ]

  return (
    <div>
      {/* Financial Summary Section */}
      <div style={{
        marginBottom: 32,
        background: 'linear-gradient(135deg, #1A1A2E 0%, #2D2B55 100%)',
        borderRadius: 16,
        padding: 28,
      }}>
        <h2 style={{
          fontSize: 18,
          fontWeight: 700,
          color: '#fff',
          marginBottom: 6,
          marginTop: 0,
        }}>
          Financial Summary
        </h2>
        <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 20, marginTop: 0 }}>
          Platform revenue breakdown across all orders
        </p>

        {/* Top row: Revenue and Net Profit as highlighted cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          {financialCards.slice(0, 2).map(card => (
            <div key={card.label} style={{
              background: 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(10px)',
              borderRadius: 12,
              padding: 24,
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 500, marginBottom: 4 }}>{card.label}</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: card.color, letterSpacing: '-0.02em' }}>{card.value}</div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>{card.description}</div>
                </div>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: card.color + '20',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                }}>
                  {card.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom row: Breakdown cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {financialCards.slice(2).map(card => (
            <div key={card.label} style={{
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 10,
              padding: 16,
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: card.color + '20',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                }}>
                  {card.icon}
                </div>
                <div style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 500 }}>{card.label}</div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{card.value}</div>
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{card.description}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Money Buckets — where the collected cash actually belongs */}
      {(() => {
        const yours = stats?.netProfit || 0
        const shops = stats?.heldForShops || 0
        const drivers = stats?.heldForDrivers || 0
        const tax = stats?.heldForTax || 0
        const buckets = [
          { label: 'Held for shops', value: shops, color: '#8B5CF6', icon: '🏪', note: 'Food revenue − commission · paid weekly' },
          { label: 'Held for drivers', value: drivers, color: '#EF4444', icon: '🚗', note: 'Base + mileage + tips · paid weekly' },
          { label: 'Held for tax', value: tax, color: '#EA580C', icon: '🏛️', note: 'Sales tax owed to Texas · Tax Center' },
          { label: 'Yours (net profit)', value: yours, color: '#10B981', icon: '📈', note: 'Commissions + fees you keep' },
        ]
        const total = buckets.reduce((s, b) => s + b.value, 0)
        const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0)
        return (
          <div style={{
            marginBottom: 32,
            background: '#fff',
            borderRadius: 16,
            padding: 28,
            border: '1px solid #E5E7EB',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1A1A2E', margin: '0 0 6px' }}>
              Whose money is this?
            </h2>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 20px' }}>
              Of the {fmt(total)} customers paid you, only your slice is profit — the rest is held for others.
            </p>

            {/* Stacked bar */}
            <div style={{ display: 'flex', height: 20, borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
              {buckets.map(b => (
                <div key={b.label} title={`${b.label}: ${fmt(b.value)}`} style={{
                  width: `${pct(b.value)}%`,
                  background: b.color,
                  minWidth: b.value > 0 ? 3 : 0,
                }} />
              ))}
            </div>

            {/* Bucket rows */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {buckets.map(b => (
                <div key={b.label} style={{
                  borderRadius: 10, padding: 16,
                  background: b.color + '0D',
                  border: `1px solid ${b.color}33`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 16 }}>{b.icon}</span>
                    <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>{b.label}</span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: b.color, letterSpacing: '-0.02em' }}>{fmt(b.value)}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                    {pct(b.value).toFixed(0)}% · {b.note}
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '16px 0 0' }}>
              All-time, delivery-service orders. Shop &amp; driver amounts are paid out in the Monday payout batch; tax is moved in the Tax Center. This is a scorecard, not live account balances.
            </p>
          </div>
        )
      })()}

      {/* Operational Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
        {operationalCards.map(card => (
          <div key={card.label} style={{
            background: '#fff', borderRadius: 12, padding: 24,
            border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 13, color: '#6B7280', fontWeight: 500, marginBottom: 8 }}>{card.label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#1A1A2E' }}>{card.value}</div>
              </div>
              <div style={{
                width: 44, height: 44, borderRadius: 10, background: card.color + '15',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
              }}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
