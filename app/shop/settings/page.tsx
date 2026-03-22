'use client'

import { useState, useEffect, useRef } from 'react'

export default function ShopSettings() {
  const [shop, setShop] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    fetch('/api/shop/settings').then(r => r.json()).then(setShop).finally(() => setLoading(false))
  }, [])

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
      () => {
        setGeoLoading(false)
        setError('Could not get location. Please allow location access.')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const uploadImage = async (file: File, type: 'image' | 'banner') => {
    const setUploading = type === 'image' ? setUploadingImage : setUploadingBanner
    setUploading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)
      const res = await fetch('/api/shop/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      const field = type === 'image' ? 'image_url' : 'banner_url'
      setShop((s: any) => ({ ...s, [field]: data.url }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
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
          <div><label style={labelStyle}>Address</label><input style={inputStyle} value={shop.address || ''} onChange={e => setShop({ ...shop, address: e.target.value })} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={labelStyle}>City</label><input style={inputStyle} value={shop.city || ''} onChange={e => setShop({ ...shop, city: e.target.value })} /></div>
            <div><label style={labelStyle}>State / Province</label><input style={inputStyle} value={shop.state || ''} onChange={e => setShop({ ...shop, state: e.target.value })} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={labelStyle}>ZIP / Postal Code</label><input style={inputStyle} value={shop.zip || ''} onChange={e => setShop({ ...shop, zip: e.target.value })} /></div>
            <div>
              <label style={labelStyle}>Country</label>
              <select style={{ ...inputStyle, background: 'white' }} value={shop.country || 'US'} onChange={e => setShop({ ...shop, country: e.target.value })}>
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="KH">Cambodia</option>
                <option value="TH">Thailand</option>
                <option value="VN">Vietnam</option>
                <option value="LA">Laos</option>
                <option value="MM">Myanmar</option>
                <option value="PH">Philippines</option>
                <option value="MY">Malaysia</option>
                <option value="SG">Singapore</option>
                <option value="ID">Indonesia</option>
                <option value="JP">Japan</option>
                <option value="KR">South Korea</option>
                <option value="CN">China</option>
                <option value="TW">Taiwan</option>
                <option value="IN">India</option>
                <option value="AU">Australia</option>
                <option value="NZ">New Zealand</option>
                <option value="GB">United Kingdom</option>
                <option value="FR">France</option>
                <option value="DE">Germany</option>
                <option value="MX">Mexico</option>
                <option value="BR">Brazil</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          {/* Location Coordinates */}
          <div style={{ background: '#FFF5F8', borderRadius: 10, padding: 16, border: '1px solid #FFE4EF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Shop Location (GPS)</label>
              <button
                onClick={useCurrentLocation}
                disabled={geoLoading}
                style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                  background: '#FF1493', color: '#fff', border: 'none', cursor: 'pointer',
                }}
              >
                {geoLoading ? 'Detecting...' : '📍 Set to Shop Location'}
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
            {(!shop.lat || !shop.lng) && !geoLoading && (
              <p style={{ fontSize: 11, color: '#DC2626', marginTop: 8, fontWeight: 600 }}>
                Location is required for driver delivery. Go to your shop and tap &quot;Set to Shop Location&quot;, then click Save.
              </p>
            )}
            {geoLoading && (
              <p style={{ fontSize: 11, color: '#FF8C00', marginTop: 8, fontWeight: 600 }}>
                Detecting your location...
              </p>
            )}
            {shop.lat && shop.lng && !geoLoading && (
              <p style={{ fontSize: 11, color: '#10B981', marginTop: 8 }}>
                Shop location saved: {shop.lat.toFixed(6)}, {shop.lng.toFixed(6)}
              </p>
            )}
            <p style={{ fontSize: 10, color: '#888', marginTop: 4 }}>
              Only update this while you are physically at the shop. This location is used to match nearby drivers.
            </p>
          </div>

          <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={shop.phone || ''} onChange={e => setShop({ ...shop, phone: e.target.value })} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div><label style={labelStyle}>Delivery Fee ($)</label><input style={inputStyle} type="number" step="0.01" value={shop.delivery_fee || ''} onChange={e => setShop({ ...shop, delivery_fee: parseFloat(e.target.value) })} /></div>
            <div><label style={labelStyle}>Min Order ($)</label><input style={inputStyle} type="number" step="0.01" value={shop.min_order || ''} onChange={e => setShop({ ...shop, min_order: parseFloat(e.target.value) })} /></div>
            <div><label style={labelStyle}>Service Fee %</label><input style={inputStyle} type="number" step="0.01" value={shop.service_fee_pct || ''} onChange={e => setShop({ ...shop, service_fee_pct: parseFloat(e.target.value) })} /></div>
          </div>
          {/* Shop Logo / Image */}
          <div>
            <label style={labelStyle}>Shop Logo / Image</label>
            {shop.image_url && (
              <div style={{ position: 'relative', width: 120, height: 120, borderRadius: 12, overflow: 'hidden', marginBottom: 8, border: '1px solid #FFD6E8' }}>
                <img src={shop.image_url} alt="Shop" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button
                  onClick={() => setShop({ ...shop, image_url: '' })}
                  style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', fontSize: 14, lineHeight: '24px', textAlign: 'center' }}
                >
                  ×
                </button>
              </div>
            )}
            <label style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '10px 16px', border: '2px dashed #FFD6E8', borderRadius: 8,
              cursor: uploadingImage ? 'wait' : 'pointer', color: '#FF1493', fontSize: 13, fontWeight: 600,
              opacity: uploadingImage ? 0.6 : 1,
            }}>
              {uploadingImage ? '⏳ Uploading...' : '📷 Upload Logo'}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) uploadImage(f, 'image')
                  if (imageInputRef.current) imageInputRef.current.value = ''
                }}
              />
            </label>
          </div>

          {/* Banner Image */}
          <div>
            <label style={labelStyle}>Banner Image</label>
            {shop.banner_url && (
              <div style={{ position: 'relative', width: '100%', height: 140, borderRadius: 12, overflow: 'hidden', marginBottom: 8, border: '1px solid #FFD6E8' }}>
                <img src={shop.banner_url} alt="Banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button
                  onClick={() => setShop({ ...shop, banner_url: '' })}
                  style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', fontSize: 14, lineHeight: '24px', textAlign: 'center' }}
                >
                  ×
                </button>
              </div>
            )}
            <label style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '10px 16px', border: '2px dashed #FFD6E8', borderRadius: 8,
              cursor: uploadingBanner ? 'wait' : 'pointer', color: '#FF1493', fontSize: 13, fontWeight: 600,
              opacity: uploadingBanner ? 0.6 : 1,
            }}>
              {uploadingBanner ? '⏳ Uploading...' : '🖼️ Upload Banner'}
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) uploadImage(f, 'banner')
                  if (bannerInputRef.current) bannerInputRef.current.value = ''
                }}
              />
            </label>
          </div>
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
