'use client'

import { useEffect, useState } from 'react'

interface Driver {
  id: string
  name: string
  email: string
  phone: string | null
  is_active: boolean
  created_at: string
  deliveryCount: number
  totalEarnings: number
}

export default function AdminDrivers() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/drivers')
      .then(r => r.json())
      .then(data => setDrivers(data.drivers || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>Loading drivers...</div>

  return (
    <div>
      <div style={{ marginBottom: 16, fontSize: 14, color: '#6B7280' }}>{drivers.length} drivers</div>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                {['Driver', 'Email', 'Phone', 'Deliveries', 'Earnings', 'Status', 'Joined'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {drivers.map(driver => (
                <tr key={driver.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: 14 }}>{driver.name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280' }}>{driver.email}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280' }}>{driver.phone || '-'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600 }}>{driver.deliveryCount}</td>
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600, color: '#10B981' }}>${driver.totalEarnings.toFixed(2)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: driver.is_active ? '#D1FAE5' : '#FEE2E2',
                      color: driver.is_active ? '#065F46' : '#991B1B',
                    }}>
                      {driver.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280' }}>
                    {new Date(driver.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {drivers.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>No drivers found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
