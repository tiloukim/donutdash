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
  const [bankInfo, setBankInfo] = useState({ bank_account_holder: '', bank_routing_number: '', bank_account_number: '' })
  const [savingBank, setSavingBank] = useState(false)
  const [bankSaved, setBankSaved] = useState(false)
  const [shopReferral, setShopReferral] = useState<any>(null)
  const [referralCopied, setReferralCopied] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    fetch('/api/shop/settings').then(r => r.json()).then(setShop).finally(() => setLoading(false))
    fetch('/api/user/bank-info').then(r => r.json()).then(d => {
      if (d.bankInfo) setBankInfo(d.bankInfo)
    }).catch(() => {})
    fetch('/api/shop/referral').then(r => r.json()).then(setShopReferral).catch(() => {})
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

          {/* Location */}
          <div style={{ background: '#FFF5F8', borderRadius: 10, padding: 16, border: '1px solid #FFE4EF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Shop Location (GPS)</label>
              <button
                onClick={useCurrentLocation}
                disabled={geoLoading}
                style={{
                  padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  background: '#FF1493', color: '#fff', border: 'none', cursor: 'pointer',
                }}
              >
                {geoLoading ? 'Detecting...' : '📍 Set to Shop Location'}
              </button>
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
              <p style={{ fontSize: 11, color: '#10B981', marginTop: 8, marginBottom: 0 }}>
                Location set
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

      {/* Bank Account for Payouts */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #FFE4EF', padding: 24, marginTop: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Bank Account (for Weekly Payouts)</h3>
        <p style={{ fontSize: 12, color: '#888', marginBottom: 16, marginTop: 0 }}>Your shop earnings (85% of sales) will be deposited weekly to this account.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Account Holder Name</label>
            <input style={inputStyle} placeholder="Business or personal name"
              value={bankInfo.bank_account_holder || ''}
              onChange={e => setBankInfo({ ...bankInfo, bank_account_holder: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Routing Number</label>
              <input style={inputStyle} placeholder="9 digits"
                value={bankInfo.bank_routing_number || ''}
                onChange={e => setBankInfo({ ...bankInfo, bank_routing_number: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Account Number</label>
              <input style={inputStyle} placeholder="Account number"
                value={bankInfo.bank_account_number || ''}
                onChange={e => setBankInfo({ ...bankInfo, bank_account_number: e.target.value })} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
          <button
            onClick={async () => {
              setSavingBank(true); setBankSaved(false)
              const res = await fetch('/api/user/bank-info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bankInfo),
              })
              if (res.ok) { setBankSaved(true); setTimeout(() => setBankSaved(false), 3000) }
              setSavingBank(false)
            }}
            disabled={savingBank}
            style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: savingBank ? '#CCC' : '#10B981', color: '#fff', fontSize: 14, fontWeight: 700, cursor: savingBank ? 'not-allowed' : 'pointer' }}
          >
            {savingBank ? 'Saving...' : 'Save Bank Info'}
          </button>
          {bankSaved && <span style={{ color: '#10B981', fontSize: 13, fontWeight: 600 }}>Bank info saved!</span>}
        </div>
      </div>
      {/* Shop Referral Program */}
      {shopReferral && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #FFE4EF', padding: 24, marginTop: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Shop Referral Program</h3>
          <p style={{ fontSize: 12, color: '#888', marginBottom: 16, marginTop: 0 }}>Refer a new shop — both of you earn $100 after they complete 20 orders!</p>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: '#FFF0F5', borderRadius: 10, padding: '12px 16px', marginBottom: 16,
          }}>
            <span style={{ fontWeight: 800, fontSize: 18, color: '#FF1493', letterSpacing: 2 }}>{shopReferral.referral_code}</span>
            <button onClick={() => {
              navigator.clipboard.writeText(shopReferral.referral_code)
              setReferralCopied(true)
              setTimeout(() => setReferralCopied(false), 2000)
            }} style={{
              padding: '4px 12px', borderRadius: 6, border: '1px solid #FFD6EC', background: '#fff',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#FF1493',
            }}>
              {referralCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 20 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#FF1493' }}>{shopReferral.completed_count || 0}</div>
              <div style={{ fontSize: 11, color: '#888' }}>Shops Referred</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#10B981' }}>${shopReferral.total_earned || 0}</div>
              <div style={{ fontSize: 11, color: '#888' }}>Total Earned</div>
            </div>
          </div>

          {shopReferral.referrals?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 8 }}>Referral Progress</div>
              {shopReferral.referrals.map((r: any) => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
                  <div style={{ fontSize: 13 }}>{r.orders_completed}/{r.orders_required || 20} orders</div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                    background: r.status === 'completed' ? '#D1FAE5' : '#FEF3C7',
                    color: r.status === 'completed' ? '#065F46' : '#92400E',
                  }}>
                    {r.status === 'completed' ? 'Completed — $100 earned!' : `${r.orders_completed}/${r.orders_required} orders`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* My Referral Progress (if this shop was referred) */}
      {shopReferral?.my_referral && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #FFE4EF', padding: 24, marginTop: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Your Referral Bonus Progress</h3>
          <p style={{ fontSize: 12, color: '#888', marginBottom: 16, marginTop: 0 }}>Complete 20 orders to earn your $100 referral bonus!</p>

          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E' }}>
                {shopReferral.my_referral.orders_completed} / {shopReferral.my_referral.orders_required} orders
              </span>
              <span style={{
                fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 6,
                background: shopReferral.my_referral.status === 'completed' ? '#D1FAE5' : '#FEF3C7',
                color: shopReferral.my_referral.status === 'completed' ? '#065F46' : '#92400E',
              }}>
                {shopReferral.my_referral.status === 'completed' ? '$100 Earned!' : `${shopReferral.my_referral.orders_required - shopReferral.my_referral.orders_completed} orders to go`}
              </span>
            </div>
            <div style={{ background: '#F3F4F6', borderRadius: 8, height: 10, overflow: 'hidden' }}>
              <div style={{
                background: shopReferral.my_referral.status === 'completed' ? '#10B981' : '#FF1493',
                height: '100%',
                width: `${Math.min(100, (shopReferral.my_referral.orders_completed / shopReferral.my_referral.orders_required) * 100)}%`,
                borderRadius: 8,
                transition: 'width 0.3s',
              }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
