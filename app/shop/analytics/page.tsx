'use client'

import { useState, useEffect } from 'react'

type AnalyticsData = {
  popularItems: { name: string; count: number; revenue: number }[]
  peakHours: number[]
  dailyTrend: { date: string; orders: number; revenue: number }[]
  avgOrderValue: number
  repeatCustomerRate: number
  totalCustomers: number
  totalOrders: number
  totalRevenue: number
}

export default function ShopAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/shop/analytics')
      .then(r => r.json())
      .then(d => { if (d.peakHours) setData(d) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300, color: '#888' }}>
      Loading analytics...
    </div>
  )

  if (!data) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300, color: '#888' }}>
      Failed to load analytics data.
    </div>
  )

  const maxPeakHour = Math.max(...data.peakHours, 1)
  const maxDailyOrders = Math.max(...data.dailyTrend.map(d => d.orders), 1)
  const maxDailyRevenue = Math.max(...data.dailyTrend.map(d => d.revenue), 1)

  return (
    <div>
      {/* Key Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Orders', value: data.totalOrders, icon: '📦', color: '#FF1493' },
          { label: 'Total Revenue', value: `$${data.totalRevenue.toFixed(2)}`, icon: '💰', color: '#10B981' },
          { label: 'Avg Order Value', value: `$${data.avgOrderValue.toFixed(2)}`, icon: '📊', color: '#6366F1' },
          { label: 'Total Customers', value: data.totalCustomers, icon: '👥', color: '#FF8C00' },
          { label: 'Repeat Customer %', value: `${data.repeatCustomerRate}%`, icon: '🔁', color: '#EC4899' },
        ].map(m => (
          <div key={m.label} style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #FFE4EF' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{m.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: m.color }}>{m.value}</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Popular Items */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #FFE4EF', marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #FFE4EF' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Popular Items</h3>
        </div>
        {data.popularItems.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>No order data yet</div>
        ) : (
          <div style={{ padding: '0 20px 16px' }}>
            {data.popularItems.map((item, i) => (
              <div key={item.name} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                borderBottom: i < data.popularItems.length - 1 ? '1px solid #FFF0F5' : 'none',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: i < 3 ? '#FF1493' : '#FFE4EF', color: i < 3 ? '#fff' : '#FF1493',
                  fontSize: 12, fontWeight: 800, flexShrink: 0,
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#FF1493' }}>{item.count} sold</div>
                  <div style={{ fontSize: 12, color: '#888' }}>${item.revenue.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Peak Hours */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #FFE4EF', marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #FFE4EF' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Peak Hours</h3>
        </div>
        <div style={{ padding: '16px 20px', overflowX: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 140, minWidth: 500 }}>
            {data.peakHours.map((count, hour) => {
              const height = maxPeakHour > 0 ? (count / maxPeakHour) * 120 : 0
              const isPeak = count === maxPeakHour && count > 0
              return (
                <div key={hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  {count > 0 && (
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#FF1493' }}>{count}</div>
                  )}
                  <div style={{
                    width: '100%', maxWidth: 20, height: Math.max(height, 2), borderRadius: '4px 4px 0 0',
                    background: isPeak ? '#FF1493' : count > 0 ? '#FFB6C1' : '#f5f5f5',
                    transition: 'height 0.3s',
                  }} />
                  <div style={{ fontSize: 9, color: '#888', whiteSpace: 'nowrap' }}>
                    {hour % 3 === 0 ? `${hour === 0 ? '12a' : hour <= 11 ? `${hour}a` : hour === 12 ? '12p' : `${hour - 12}p`}` : ''}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Daily Trend */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #FFE4EF', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #FFE4EF' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Daily Trend (Last 30 Days)</h3>
        </div>
        <div style={{ padding: '16px 20px', overflowX: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 160, minWidth: 600 }}>
            {data.dailyTrend.map((day) => {
              const orderHeight = maxDailyOrders > 0 ? (day.orders / maxDailyOrders) * 100 : 0
              const revenueHeight = maxDailyRevenue > 0 ? (day.revenue / maxDailyRevenue) * 100 : 0
              const dateObj = new Date(day.date + 'T12:00:00')
              const isFirst = day.date === data.dailyTrend[0]?.date
              const isSunday = dateObj.getDay() === 0
              return (
                <div key={day.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }} title={`${day.date}: ${day.orders} orders, $${day.revenue.toFixed(2)}`}>
                  <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end', height: 100 }}>
                    <div style={{
                      width: 6, height: Math.max(orderHeight, 1), borderRadius: 2,
                      background: day.orders > 0 ? '#FF1493' : '#f5f5f5',
                    }} />
                    <div style={{
                      width: 6, height: Math.max(revenueHeight, 1), borderRadius: 2,
                      background: day.revenue > 0 ? '#FFB6C1' : '#f5f5f5',
                    }} />
                  </div>
                  <div style={{ fontSize: 8, color: '#888', whiteSpace: 'nowrap', transform: 'rotate(-45deg)', transformOrigin: 'center', marginTop: 8 }}>
                    {(isFirst || isSunday) ? `${dateObj.getMonth() + 1}/${dateObj.getDate()}` : ''}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 16, fontSize: 12, color: '#888' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: '#FF1493' }} /> Orders
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: '#FFB6C1' }} /> Revenue
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
