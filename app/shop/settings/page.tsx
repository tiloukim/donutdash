'use client'

import { useState, useEffect } from 'react'

export default function ShopSettings() {
  const [shop, setShop] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)

  useEffect(() => {
    fetch('/api/shop/settings').then(r => r.json()).then(setShop).finally(() => setLoading(false))
  }, [])

  const [error, setError] = useState('')

  const save = async () => {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const res = await fetch('/api/shop/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(shop) })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to save')
      } else {
        setShop(data)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch {
      setError('Network error')
    }
    setSaving(false)
  }

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setShop((s: any) => ({ ...s, lat: pos.coords.latitude, lng: pos.coords.longitude }))
        setGeoLoading(false)
      },
      () => setGeoLoading(false),
      { enableHighAccuracy: true }
    )
  }

  if (loading || !shop) return <div>Loading settings...</div>

  const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid #FFD6E8', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' as const }
  const labelStyle = { fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' } as const

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #FFE4EF', padding: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={labelStyle}>Shop Name</label><input style={inputStyle} value={shop.name || ''} onChange={e => setShop({ ...shop, name: e.target.value })} /></div>
          <div><label style={labelStyle}>Description</label><textarea style={{ ...inputStyle, minHeight: 80 }} value={shop.description || ''} onChange={e => setShop({ ...shop, description: e.target.value })} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={labelStyle}>Address</label><input style={inputStyle} value={shop.address || ''} onChange={e => setShop({ ...shop, address: e.target.value })} /></div>
            <div><label style={labelStyle}>City</label><input style={inputStyle} value={shop.city || ''} onChange={e => setShop({ ...shop, city: e.target.value })} /></div>
            <div><label style={labelStyle}>State</label><input style={inputStyle} value={shop.state || ''} onChange={e => setShop({ ...shop, state: e.target.value })} /></div>
            <div><label style={labelStyle}>ZIP</label><input style={inputStyle} value={shop.zip || ''} onChange={e => setShop({ ...shop, zip: e.target.value })} /></div>
          </div>

          {/* Location Coordinates */}
          <div style={{ background: '#FFF5F8', borderRadius: 10, padding: 16, border: '1px solid #FFE4EF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Shop Location (GPS Coordinates)</label>
              <button
                onClick={useCurrentLocation}
                disabled={geoLoading}
                style={{
                  padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  background: '#FF1493', color: '#fff', border: 'none', cursor: 'pointer',
                }}
              >
                {geoLoading ? 'Getting...' : 'Use Current Location'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ ...labelStyle, fontSize: 11 }}>Latitude</label>
                <input
                  style={inputStyle}
                  type="number"
                  step="0.000001"
                  placeholder="e.g. 34.0522"
                  value={shop.lat || ''}
                  onChange={e => setShop({ ...shop, lat: parseFloat(e.target.value) || null })}
                />
              </div>
              <div>
                <label style={{ ...labelStyle, fontSize: 11 }}>Longitude</label>
                <input
                  style={inputStyle}
                  type="number"
                  step="0.000001"
                  placeholder="e.g. -118.2437"
                  value={shop.lng || ''}
                  onChange={e => setShop({ ...shop, lng: parseFloat(e.target.value) || null })}
                />
              </div>
            </div>
            {(!shop.lat || !shop.lng) && (
              <p style={{ fontSize: 11, color: '#DC2626', marginTop: 8, fontWeight: 600 }}>
                Location is required for driver delivery assignments. Please set your coordinates.
              </p>
            )}
            {shop.lat && shop.lng && (
              <p style={{ fontSize: 11, color: '#10B981', marginTop: 8 }}>
                Location set: {shop.lat.toFixed(6)}, {shop.lng.toFixed(6)}
              </p>
            )}
          </div>

          <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={shop.phone || ''} onChange={e => setShop({ ...shop, phone: e.target.value })} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div><label style={labelStyle}>Delivery Fee ($)</label><input style={inputStyle} type="number" step="0.01" value={shop.delivery_fee || ''} onChange={e => setShop({ ...shop, delivery_fee: parseFloat(e.target.value) })} /></div>
            <div><label style={labelStyle}>Min Order ($)</label><input style={inputStyle} type="number" step="0.01" value={shop.min_order || ''} onChange={e => setShop({ ...shop, min_order: parseFloat(e.target.value) })} /></div>
            <div><label style={labelStyle}>Service Fee %</label><input style={inputStyle} type="number" step="0.01" value={shop.service_fee_pct || ''} onChange={e => setShop({ ...shop, service_fee_pct: parseFloat(e.target.value) })} /></div>
          </div>
          <div><label style={labelStyle}>Image URL</label><input style={inputStyle} value={shop.image_url || ''} onChange={e => setShop({ ...shop, image_url: e.target.value })} /></div>
          <div><label style={labelStyle}>Banner URL</label><input style={inputStyle} value={shop.banner_url || ''} onChange={e => setShop({ ...shop, banner_url: e.target.value })} /></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20 }}>
          <button onClick={save} disabled={saving} style={{ padding: '10px 32px', borderRadius: 8, fontSize: 14, fontWeight: 700, background: '#FF1493', color: '#fff', border: 'none', cursor: 'pointer' }}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {saved && <span style={{ color: '#10B981', fontSize: 13, fontWeight: 600 }}>Saved!</span>}
          {error && <span style={{ color: '#DC2626', fontSize: 13, fontWeight: 600 }}>{error}</span>}
        </div>
      </div>
    </div>
  )
}
