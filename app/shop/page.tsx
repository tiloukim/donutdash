'use client'

import { useState, useEffect } from 'react'
import { SHOP_COMMISSION_RATE } from '@/lib/constants'

export default function ShopDashboard() {
  const [stats, setStats] = useState<{ todayOrders: number; todayRevenue: number; pendingOrders: number; totalOrders: number; recentOrders: any[] }>({ todayOrders: 0, todayRevenue: 0, pendingOrders: 0, totalOrders: 0, recentOrders: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/shop/stats')
      .then(r => r.json())
      .then(data => {
        if (data.todayOrders !== undefined) setStats(data)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div>Loading dashboard...</div>

  const shopEarnings = stats.todayRevenue * (1 - SHOP_COMMISSION_RATE)
  const commission = stats.todayRevenue * SHOP_COMMISSION_RATE

  const cards = [
    { label: "Today's Orders", value: stats.todayOrders, color: '#FF1493', icon: '📦' },
    { label: "Today's Sales", value: `$${stats.todayRevenue.toFixed(2)}`, color: '#6366F1', icon: '📊' },
    { label: "Your Earnings", value: `$${shopEarnings.toFixed(2)}`, color: '#10B981', icon: '💰' },
    { label: `Commission (${(SHOP_COMMISSION_RATE * 100).toFixed(0)}%)`, value: `$${commission.toFixed(2)}`, color: '#FF8C00', icon: '🏷️' },
    { label: 'Pending Orders', value: stats.pendingOrders, color: '#DC2626', icon: '⏳' },
    { label: 'Total Orders', value: stats.totalOrders, color: '#888', icon: '📋' },
  ]

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #FFE4EF' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{c.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{c.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #FFE4EF', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #FFE4EF' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Recent Orders</h3>
        </div>
        {stats.recentOrders.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>No orders yet</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #FFE4EF' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: '#888', fontWeight: 600 }}>Order</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: '#888', fontWeight: 600 }}>Customer</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: '#888', fontWeight: 600 }}>Subtotal</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: '#888', fontWeight: 600 }}>You Earn</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: '#888', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: '#888', fontWeight: 600 }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentOrders.map((o: any) => (
                <tr key={o.id} style={{ borderBottom: '1px solid #FFF0F5' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 600, color: '#FF1493' }}>#{o.id.slice(0, 8)}</td>
                  <td style={{ padding: '10px 16px' }}>{o.customer?.name || 'Customer'}</td>
                  <td style={{ padding: '10px 16px' }}>${(o.subtotal || o.total).toFixed(2)}</td>
                  <td style={{ padding: '10px 16px', fontWeight: 700, color: '#10B981' }}>${((o.subtotal || o.total) * (1 - SHOP_COMMISSION_RATE)).toFixed(2)}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: o.status === 'delivered' ? '#D1FAE5' : o.status === 'pending' ? '#FEF3C7' : '#E0E7FF', color: o.status === 'delivered' ? '#065F46' : o.status === 'pending' ? '#92400E' : '#3730A3' }}>
                      {o.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', color: '#888' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
