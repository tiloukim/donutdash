'use client'

import { useState, useEffect, useCallback } from 'react'

interface AnalyticsData {
  totalViews: number
  uniqueSessions: number
  liveVisitors: number
  liveByRole: { customers: number; drivers: number; shopOwners: number }
  topCities: { city: string; count: number; lat: number | null; lng: number | null; region: string | null; country: string | null }[]
  topPages: { page: string; count: number }[]
  devices: { desktop: number; mobile: number; tablet: number }
  topShopViews: { shopId: string; name: string; views: number; orders: number }[]
  hourlyTraffic: { hour: string; count: number }[]
  dailyTraffic: { day: string; count: number }[]
  range: string
}

const RANGES = [
  { key: '24h', label: 'Last 24h' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: '90d', label: '90 Days' },
]

export default function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [range, setRange] = useState('7d')
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/admin/analytics?range=${range}`)
    if (res.ok) {
      const d = await res.json()
      setData(d)
    }
    setLoading(false)
  }, [range])

  useEffect(() => {
    setLoading(true)
    fetchData()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const cardStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB',
    padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  }

  const maxDailyCount = data ? Math.max(...data.dailyTraffic.map(d => d.count), 1) : 1
  const maxShopViews = data ? Math.max(...data.topShopViews.map(s => s.views), 1) : 1
  const totalDevices = data ? (data.devices.desktop + data.devices.mobile + data.devices.tablet) || 1 : 1

  if (loading && !data) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <div style={{ color: '#6366F1', fontWeight: 600 }}>Loading analytics...</div>
    </div>
  )

  if (!data) return <div style={{ padding: 40, color: '#999' }}>No data available</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#1A1A2E' }}>Live Analytics</h2>
          <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>
            Auto-refreshes every 30 seconds
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)} style={{
              padding: '6px 14px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
              background: range === r.key ? '#6366F1' : '#F3F4F6',
              color: range === r.key ? '#fff' : '#666',
            }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Live Online by Role */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div style={{ ...cardStyle, borderLeft: '4px solid #10B981' }}>
          <div style={{ fontSize: 12, color: '#888', fontWeight: 600 }}>LIVE NOW</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#10B981' }}>
            {data.liveVisitors}
            <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 4, color: '#10B981', animation: 'pulse 2s infinite' }}>●</span>
          </div>
          <div style={{ fontSize: 11, color: '#aaa' }}>total online</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: '4px solid #FF8C00' }}>
          <div style={{ fontSize: 12, color: '#888', fontWeight: 600 }}>🛒 CUSTOMERS</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#FF8C00' }}>
            {data.liveByRole.customers}
            {data.liveByRole.customers > 0 && <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 4, color: '#FF8C00', animation: 'pulse 2s infinite' }}>●</span>}
          </div>
          <div style={{ fontSize: 11, color: '#aaa' }}>browsing / ordering</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: '4px solid #3B82F6' }}>
          <div style={{ fontSize: 12, color: '#888', fontWeight: 600 }}>🚗 DRIVERS</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#3B82F6' }}>
            {data.liveByRole.drivers}
            {data.liveByRole.drivers > 0 && <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 4, color: '#3B82F6', animation: 'pulse 2s infinite' }}>●</span>}
          </div>
          <div style={{ fontSize: 11, color: '#aaa' }}>driver portal</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: '4px solid #8B5CF6' }}>
          <div style={{ fontSize: 12, color: '#888', fontWeight: 600 }}>🏪 SHOP OWNERS</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#8B5CF6' }}>
            {data.liveByRole.shopOwners}
            {data.liveByRole.shopOwners > 0 && <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 4, color: '#8B5CF6', animation: 'pulse 2s infinite' }}>●</span>}
          </div>
          <div style={{ fontSize: 11, color: '#aaa' }}>shop dashboard</div>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div style={{ ...cardStyle, borderLeft: '4px solid #6366F1' }}>
          <div style={{ fontSize: 12, color: '#888', fontWeight: 600 }}>PAGE VIEWS</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#1A1A2E' }}>{data.totalViews.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: '#aaa' }}>{range === '24h' ? 'last 24 hours' : `last ${range}`}</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: '4px solid #F59E0B' }}>
          <div style={{ fontSize: 12, color: '#888', fontWeight: 600 }}>UNIQUE VISITORS</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#1A1A2E' }}>{data.uniqueSessions.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: '#aaa' }}>unique sessions</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: '4px solid #EC4899' }}>
          <div style={{ fontSize: 12, color: '#888', fontWeight: 600 }}>DEVICES</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 8 }}>
            <span style={{ color: '#6366F1' }}>📱 {Math.round(data.devices.mobile / totalDevices * 100)}%</span>
            <span style={{ color: '#888', margin: '0 6px' }}>|</span>
            <span style={{ color: '#1A1A2E' }}>💻 {Math.round(data.devices.desktop / totalDevices * 100)}%</span>
          </div>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>mobile vs desktop</div>
        </div>
      </div>

      {/* Daily Traffic Chart */}
      {data.dailyTraffic.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>Daily Traffic</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
            {data.dailyTraffic.map((d, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 10, color: '#888', fontWeight: 600 }}>{d.count}</div>
                <div style={{
                  width: '100%', maxWidth: 40,
                  height: `${(d.count / maxDailyCount) * 100}px`,
                  background: 'linear-gradient(180deg, #6366F1, #818CF8)',
                  borderRadius: '4px 4px 0 0',
                  minHeight: 4,
                }} />
                <div style={{ fontSize: 9, color: '#aaa', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
                  {new Date(d.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 20 }}>
        {/* Top Cities / Visitor Locations */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px' }}>
            📍 Visitor Locations
          </h3>
          {data.topCities.length === 0 ? (
            <div style={{ color: '#999', fontSize: 13 }}>No location data yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.topCities.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', background: '#EEF2FF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: '#6366F1', flexShrink: 0,
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {c.city}{c.region && c.region.length === 2 && /^[A-Z]+$/.test(c.region) ? `, ${c.region}` : c.country ? ` (${c.country})` : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#6366F1' }}>{c.count}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Shops */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px' }}>
            🍩 Most Visited Shops
          </h3>
          {data.topShopViews.length === 0 ? (
            <div style={{ color: '#999', fontSize: 13 }}>No shop visit data yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.topShopViews.map((s, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>
                      <span style={{ color: '#6366F1', fontWeight: 700 }}>{s.views}</span> views
                      <span style={{ margin: '0 6px', color: '#ddd' }}>|</span>
                      <span style={{ color: '#10B981', fontWeight: 700 }}>{s.orders}</span> orders
                    </div>
                  </div>
                  <div style={{ background: '#F3F4F6', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 4,
                      width: `${(s.views / maxShopViews) * 100}%`,
                      background: 'linear-gradient(90deg, #6366F1, #818CF8)',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {/* Top Pages */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px' }}>
            📄 Top Pages
          </h3>
          {data.topPages.length === 0 ? (
            <div style={{ color: '#999', fontSize: 13 }}>No page data yet</div>
          ) : (
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <th style={{ textAlign: 'left', padding: '6px 0', color: '#888', fontWeight: 600 }}>Page</th>
                  <th style={{ textAlign: 'right', padding: '6px 0', color: '#888', fontWeight: 600 }}>Views</th>
                </tr>
              </thead>
              <tbody>
                {data.topPages.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '8px 0', fontFamily: 'monospace', fontSize: 12, color: '#333' }}>{p.page}</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#6366F1' }}>{p.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Device Breakdown */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px' }}>
            📱 Device Breakdown
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Mobile', value: data.devices.mobile, icon: '📱', color: '#6366F1' },
              { label: 'Desktop', value: data.devices.desktop, icon: '💻', color: '#10B981' },
              { label: 'Tablet', value: data.devices.tablet, icon: '📟', color: '#F59E0B' },
            ].map((d, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 14 }}>{d.icon} {d.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>
                    {d.value} <span style={{ color: '#888', fontWeight: 400 }}>({Math.round(d.value / totalDevices * 100)}%)</span>
                  </span>
                </div>
                <div style={{ background: '#F3F4F6', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 4,
                    width: `${(d.value / totalDevices) * 100}%`,
                    background: d.color,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
