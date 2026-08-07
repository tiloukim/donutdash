'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// POS fleet presence. Each register (Elo / tablet) heartbeats
// /api/pos/heartbeat every ~45s; a device is "online" if seen within 2 min
// (the server stamps the flag). This view groups devices by shop so you can
// see, at a glance, which registers are up and which card terminal each is
// bound to — e.g. "is the main Elo online / holding the P8?".

interface Device {
  shop_id: string
  device_id: string
  register_label: string | null
  platform: string | null
  app_version: string | null
  card_terminal_tpn: string | null
  card_terminal_connected: boolean | null
  card_terminal_checked_at: string | null
  last_ip: string | null
  last_seen_at: string
  online: boolean
  shop: { name: string | null; address: string | null; city: string | null; state: string | null; zip: string | null } | null
}

// "7205 South Broadway Ave, Tyler, TX 75703" from the parts that exist.
function shopAddress(s: Device['shop']): string | null {
  if (!s) return null
  const line = [s.address, [s.city, s.state].filter(Boolean).join(', '), s.zip].filter(Boolean).join(', ')
  return line || null
}

const REFRESH_MS = 20_000

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function shortId(id: string): string {
  return id.replace(/-/g, '').slice(0, 8)
}

const pill: React.CSSProperties = { padding: '1px 7px', borderRadius: 999, fontSize: 11, fontWeight: 700 }

// Live reachability of the card terminal this register is bound to. The app
// probes SPIn every few minutes; null means it hasn't reported one yet.
function TerminalBadge({ device }: { device: Device }) {
  const connected = device.card_terminal_connected
  const age = device.card_terminal_checked_at ? ` · ${timeAgo(device.card_terminal_checked_at)}` : ''
  if (connected === null || connected === undefined) {
    return <span style={{ ...pill, background: '#F3F4F6', color: '#6B7280' }}>not checked</span>
  }
  return connected ? (
    <span style={{ ...pill, background: '#D1FAE5', color: '#065F46' }}>terminal online{age}</span>
  ) : (
    <span style={{ ...pill, background: '#FEE2E2', color: '#991B1B' }}>terminal unreachable{age}</span>
  )
}

export default function AdminDevices() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/pos/heartbeat')
      if (!res.ok) throw new Error((await res.text()) || `Failed (${res.status})`)
      const data = (await res.json()) as { devices: Device[] }
      setDevices(data.devices ?? [])
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load devices')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
    timer.current = setInterval(() => void load(), REFRESH_MS)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [load])

  // Group by shop, shops with any online device first.
  const byShop = new Map<string, Device[]>()
  for (const d of devices) {
    const name = d.shop?.name ?? 'Unknown shop'
    if (!byShop.has(name)) byShop.set(name, [])
    byShop.get(name)!.push(d)
  }
  const shops = [...byShop.entries()].sort((a, b) => {
    const aOnline = a[1].some((d) => d.online) ? 0 : 1
    const bOnline = b[1].some((d) => d.online) ? 0 : 1
    return aOnline - bOnline || a[0].localeCompare(b[0])
  })

  const onlineCount = devices.filter((d) => d.online).length

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '8px 0 48px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: '#111827' }}>POS Devices</h1>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
            {loading ? 'Loading…' : `${onlineCount} online · ${devices.length} total`}
            {refreshing && !loading ? ' · refreshing…' : ''}
          </div>
        </div>
        <button
          onClick={() => void load()}
          style={{
            background: '#111827', color: '#fff', border: 'none', borderRadius: 8,
            padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div style={{ background: '#FEE2E2', color: '#991B1B', borderRadius: 10, padding: 14, fontSize: 14, marginBottom: 16 }}>
          {error}
        </div>
      ) : null}

      {!loading && devices.length === 0 && !error ? (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 32, textAlign: 'center', color: '#6B7280' }}>
          No POS devices have checked in yet. A register appears here after it signs in and sends its first heartbeat.
        </div>
      ) : null}

      {shops.map(([shopName, list]) => (
        <div key={shopName} style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#6B7280' }}>
              {shopName}
            </div>
            {shopAddress(list[0]?.shop) ? (
              <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{shopAddress(list[0].shop)}</div>
            ) : null}
          </div>
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
            {list.map((d, i) => (
              <div
                key={d.device_id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                  borderTop: i === 0 ? 'none' : '1px solid #F3F4F6',
                }}
              >
                <span
                  title={d.online ? 'Online' : 'Offline'}
                  style={{
                    width: 10, height: 10, borderRadius: 999, flexShrink: 0,
                    background: d.online ? '#10B981' : '#D1D5DB',
                    boxShadow: d.online ? '0 0 0 3px rgba(16,185,129,0.15)' : 'none',
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
                    {d.register_label || `Register ${shortId(d.device_id)}`}
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {d.card_terminal_tpn ? (
                      <>
                        <span>Terminal {d.card_terminal_tpn}</span>
                        <TerminalBadge device={d} />
                      </>
                    ) : (
                      <span>No card terminal</span>
                    )}
                    <span style={{ color: '#D1D5DB' }}>·</span>
                    {d.app_version ? <span>v{d.app_version}</span> : null}
                    {d.platform ? <span>{d.platform}</span> : null}
                    {d.last_ip ? (
                      <>
                        <span style={{ color: '#D1D5DB' }}>·</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>IP {d.last_ip}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: d.online ? '#059669' : '#9CA3AF' }}>
                    {d.online ? 'Online' : 'Offline'}
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                    seen {timeAgo(d.last_seen_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
