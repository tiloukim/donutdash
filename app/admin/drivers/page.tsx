'use client'

import { useEffect, useState, useRef } from 'react'
import dynamic from 'next/dynamic'

const DriversMap = dynamic(() => import('@/components/DriversMap'), { ssr: false })

interface Driver {
  id: string
  name: string
  email: string
  phone: string | null
  is_active: boolean
  is_online: boolean
  lat: number | null
  lng: number | null
  last_seen: string | null
  created_at: string
  deliveryCount: number
  totalEarnings: number
}

export default function AdminDrivers() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [showMap, setShowMap] = useState(true)

  const fetchDrivers = () => {
    fetch(`/api/admin/drivers?t=${Date.now()}`)
      .then(r => r.json())
      .then(data => setDrivers(data.drivers || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchDrivers()
    // Poll every 5 seconds for live tracking
    const interval = setInterval(fetchDrivers, 5000)
    return () => clearInterval(interval)
  }, [])

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>Loading drivers...</div>

  const onlineDrivers = drivers.filter(d => d.is_online && d.lat && d.lng && d.lat !== 0 && d.lng !== 0)
  const onlineCount = drivers.filter(d => d.is_online).length

  return (
    <div>
      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ background: '#fff', borderRadius: 10, padding: '14px 20px', border: '1px solid #E5E7EB', flex: '1 1 150px' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1A1A2E' }}>{drivers.length}</div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>Total Drivers</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 10, padding: '14px 20px', border: '1px solid #E5E7EB', flex: '1 1 150px' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#10B981' }}>{onlineCount}</div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>Online Now</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 10, padding: '14px 20px', border: '1px solid #E5E7EB', flex: '1 1 150px' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#6366F1' }}>{onlineDrivers.length}</div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>With GPS</div>
        </div>
      </div>

      {/* Map toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E', margin: 0 }}>
          Live Driver Map
          {onlineCount > 0 && (
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#10B981', marginLeft: 8, animation: 'pulse 2s infinite' }} />
          )}
        </h3>
        <button
          onClick={() => setShowMap(!showMap)}
          style={{
            background: 'none', border: '1px solid #E5E7EB', borderRadius: 6,
            padding: '4px 12px', fontSize: 12, color: '#6B7280', cursor: 'pointer',
          }}
        >
          {showMap ? 'Hide Map' : 'Show Map'}
        </button>
      </div>

      {/* Map */}
      {showMap && (
        <div style={{
          background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB',
          overflow: 'hidden', marginBottom: 24, height: 400,
        }}>
          {onlineDrivers.length > 0 ? (
            <DriversMap drivers={onlineDrivers.map(d => ({
              id: d.id,
              name: d.name,
              lat: d.lat!,
              lng: d.lng!,
              is_online: d.is_online,
              last_seen: d.last_seen,
            }))} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9CA3AF' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📍</div>
                <p>No online drivers with GPS data</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Drivers table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                {['Driver', 'Email', 'Phone', 'Deliveries', 'Earnings', 'Online', 'Location', 'Last GPS', 'Account', 'Joined'].map(h => (
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
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: driver.is_online ? '#D1FAE5' : '#F3F4F6',
                      color: driver.is_online ? '#065F46' : '#6B7280',
                    }}>
                      {driver.is_online && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />}
                      {driver.is_online ? 'Online' : 'Offline'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#6B7280' }}>
                    {driver.is_online && driver.lat && driver.lng && driver.lat !== 0
                      ? `${driver.lat.toFixed(4)}, ${driver.lng.toFixed(4)}`
                      : '-'
                    }
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#6B7280' }}>
                    {driver.last_seen
                      ? new Date(driver.last_seen).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })
                      : '-'
                    }
                  </td>
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
                <tr><td colSpan={10} style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>No drivers found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
