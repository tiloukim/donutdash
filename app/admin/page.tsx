'use client'

import { useEffect, useState } from 'react'

interface Stats {
  totalRevenue: number
  totalOrders: number
  activeShops: number
  activeDrivers: number
  totalUsers: number
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

  const cards = [
    { label: 'Total Revenue', value: `$${(stats?.totalRevenue || 0).toFixed(2)}`, color: '#10B981', icon: '💰' },
    { label: 'Total Orders', value: String(stats?.totalOrders || 0), color: '#6366F1', icon: '📦' },
    { label: 'Active Shops', value: String(stats?.activeShops || 0), color: '#F59E0B', icon: '🏪' },
    { label: 'Active Drivers', value: String(stats?.activeDrivers || 0), color: '#3B82F6', icon: '🚗' },
    { label: 'Total Users', value: String(stats?.totalUsers || 0), color: '#EC4899', icon: '👥' },
  ]

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
        {cards.map(card => (
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
