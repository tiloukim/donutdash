'use client'

import { useEffect, useState } from 'react'

interface ShopPayout {
  id: string
  name: string
  orders: number
  subtotal: number
  commission: number
  payout: number
}

interface DriverPayout {
  id: string
  name: string
  phone: string
  email: string
  deliveries: number
  earnings: number
  tips: number
  basePay: number
}

interface PayoutData {
  period: string
  summary: {
    totalRevenue: number
    totalShopPayouts: number
    totalDriverPayouts: number
    totalCommissions: number
    totalServiceFees: number
    totalDeliveryFees: number
    platformProfit: number
    totalOrders: number
  }
  shopPayouts: ShopPayout[]
  driverPayouts: DriverPayout[]
}

export default function PayoutsPage() {
  const [data, setData] = useState<PayoutData | null>(null)
  const [period, setPeriod] = useState('week')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/payouts?period=${period}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [period])

  const fmt = (n: number) => `$${n.toFixed(2)}`

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading payouts...</div>
  if (!data) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Failed to load data</div>

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1A1A2E' }}>Payouts</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {['week', 'month', 'all'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: period === p ? '#FF1493' : '#f0f0f0',
                color: period === p ? '#fff' : '#666',
                fontWeight: 600, fontSize: 13,
              }}
            >
              {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 32 }}>
        <SummaryCard label="Total Revenue" value={fmt(data.summary.totalRevenue)} color="#10B981" />
        <SummaryCard label="Shop Payouts" value={fmt(data.summary.totalShopPayouts)} color="#FF8C00" />
        <SummaryCard label="Driver Payouts" value={fmt(data.summary.totalDriverPayouts)} color="#3B82F6" />
        <SummaryCard label="Platform Profit" value={fmt(data.summary.platformProfit)} color="#FF1493" />
        <SummaryCard label="Orders" value={String(data.summary.totalOrders)} color="#8B5CF6" />
      </div>

      {/* Shop Payouts */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #f0f0f0', padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1A1A2E' }}>Shop Payouts</h2>
          <span style={{ fontSize: 14, color: '#888' }}>Total: {fmt(data.summary.totalShopPayouts)}</span>
        </div>
        {data.shopPayouts.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center', padding: 20 }}>No delivered orders this period</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                <th style={thStyle}>Shop</th>
                <th style={thStyle}>Orders</th>
                <th style={thStyle}>Sales</th>
                <th style={thStyle}>Commission (15%)</th>
                <th style={{ ...thStyle, color: '#FF8C00' }}>Owed to Shop</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.shopPayouts.map(shop => (
                <tr key={shop.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                  <td style={tdStyle}><strong>{shop.name}</strong></td>
                  <td style={tdStyle}>{shop.orders}</td>
                  <td style={tdStyle}>{fmt(shop.subtotal)}</td>
                  <td style={tdStyle}>{fmt(shop.commission)}</td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: '#FF8C00' }}>{fmt(shop.payout)}</td>
                  <td style={tdStyle}>
                    <span style={{ padding: '4px 10px', borderRadius: 6, background: '#FEF3C7', color: '#92400E', fontSize: 12, fontWeight: 600 }}>
                      Pending
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Driver Payouts */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #f0f0f0', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1A1A2E' }}>Driver Payouts</h2>
          <span style={{ fontSize: 14, color: '#888' }}>Total: {fmt(data.summary.totalDriverPayouts)}</span>
        </div>
        {data.driverPayouts.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center', padding: 20 }}>No completed deliveries this period</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                <th style={thStyle}>Driver</th>
                <th style={thStyle}>Contact</th>
                <th style={thStyle}>Deliveries</th>
                <th style={thStyle}>Base Pay</th>
                <th style={thStyle}>Tips</th>
                <th style={{ ...thStyle, color: '#3B82F6' }}>Total Owed</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.driverPayouts.map(driver => (
                <tr key={driver.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                  <td style={tdStyle}><strong>{driver.name}</strong></td>
                  <td style={tdStyle}>
                    {driver.phone && <a href={`tel:${driver.phone}`} style={{ color: '#3B82F6', textDecoration: 'none', fontSize: 13 }}>{driver.phone}</a>}
                    {!driver.phone && <span style={{ color: '#888', fontSize: 13 }}>{driver.email || '—'}</span>}
                  </td>
                  <td style={tdStyle}>{driver.deliveries}</td>
                  <td style={tdStyle}>{fmt(driver.basePay)}</td>
                  <td style={tdStyle}>{fmt(driver.tips)}</td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: '#3B82F6' }}>{fmt(driver.earnings)}</td>
                  <td style={tdStyle}>
                    <span style={{ padding: '4px 10px', borderRadius: 6, background: '#FEF3C7', color: '#92400E', fontSize: 12, fontWeight: 600 }}>
                      Pending
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* How to Pay */}
      <div style={{ background: '#F0F9FF', borderRadius: 12, border: '1px solid #BAE6FD', padding: 20, marginTop: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0369A1', marginBottom: 8 }}>How to Process Payouts</h3>
        <ul style={{ fontSize: 13, color: '#0C4A6E', lineHeight: 1.8, margin: 0, paddingLeft: 20 }}>
          <li>Review the amounts above for the selected period</li>
          <li>Pay shops via <strong>Zelle, Venmo, or bank transfer</strong></li>
          <li>Pay drivers via <strong>Zelle, Venmo, or Cash App</strong></li>
          <li>Automated payouts will be available when Stripe Connect is approved</li>
        </ul>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #f0f0f0', padding: 16 }}>
      <p style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 800, color }}>{value}</p>
    </div>
  )
}

const thStyle: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase' }
const tdStyle: React.CSSProperties = { padding: '12px', fontSize: 14 }
