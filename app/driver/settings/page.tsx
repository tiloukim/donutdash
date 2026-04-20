'use client'

import { useState, useEffect, useRef } from 'react'

export default function DriverSettings() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [bankInfo, setBankInfo] = useState<any>({
    bank_account_holder: '', bank_routing_number: '', bank_account_number: '',
    payout_method: 'ach', paypal_email: '', venmo_handle: '', cashapp_handle: '',
  })
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('')
  const [savingBank, setSavingBank] = useState(false)
  const [bankSaved, setBankSaved] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Vehicle fields stored in local state only (no DB columns yet)
  const [vehicle, setVehicle] = useState({
    type: '',
    make: '',
    model: '',
    color: '',
    licensePlate: '',
  })

  useEffect(() => {
    fetch('/api/driver/settings')
      .then(r => r.json())
      .then(data => {
        setProfile(data)
        // Restore vehicle info from localStorage if available
        const savedVehicle = localStorage.getItem('dd_driver_vehicle')
        if (savedVehicle) {
          try { setVehicle(JSON.parse(savedVehicle)) } catch {}
        }
      })
      .finally(() => setLoading(false))
    // Fetch bank info
    fetch('/api/user/bank-info').then(r => r.json()).then(d => {
      if (d.bankInfo) setBankInfo(d.bankInfo)
    }).catch(() => {})
  }, [])

  const save = async () => {
    setSaving(true)
    setSaved(false)
    // Save vehicle to localStorage
    localStorage.setItem('dd_driver_vehicle', JSON.stringify(vehicle))
    // Save profile to API
    const res = await fetch('/api/driver/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: profile.name,
        phone: profile.phone,
        avatar_url: profile.avatar_url,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setProfile(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  if (loading || !profile) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
        <div style={{ color: '#FF8C00', fontSize: 16, fontWeight: 600 }}>Loading settings...</div>
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #FFE0B2',
    borderRadius: 8,
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: '#666',
    display: 'block',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  }

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 700,
    color: '#333',
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  }

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #FFE0B2',
    padding: 24,
    marginBottom: 16,
  }

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    paddingRight: 32,
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#333', margin: 0 }}>Driver Settings</h1>
        <p style={{ fontSize: 14, color: '#888', margin: '4px 0 0' }}>Manage your profile and vehicle information</p>
      </div>

      {/* Profile Photo Section */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>
          <span style={{ width: 4, height: 20, background: '#FF8C00', borderRadius: 2, display: 'inline-block' }}></span>
          Profile Photo
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: profile.avatar_url ? `url(${profile.avatar_url}) center/cover` : 'linear-gradient(135deg, #FF8C00, #FFA940)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 28,
            fontWeight: 700,
            flexShrink: 0,
            border: '3px solid #FFE0B2',
          }}>
            {!profile.avatar_url && (profile.name?.[0]?.toUpperCase() || 'D')}
          </div>
          <div style={{ flex: 1 }}>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setUploadingPhoto(true)
                const formData = new FormData()
                formData.append('file', file)
                formData.append('type', 'image')
                try {
                  const res = await fetch('/api/upload', { method: 'POST', body: formData })
                  const data = await res.json()
                  if (res.ok && data.url) {
                    setProfile((p: any) => ({ ...p, avatar_url: data.url }))
                  }
                } catch {}
                setUploadingPhoto(false)
                if (photoInputRef.current) photoInputRef.current.value = ''
              }}
            />
            <button
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
              style={{
                padding: '10px 20px', borderRadius: 8, border: '2px dashed #FFE0B2',
                background: '#FFF8F0', color: '#FF8C00', fontSize: 13, fontWeight: 700,
                cursor: uploadingPhoto ? 'wait' : 'pointer', width: '100%',
              }}
            >
              {uploadingPhoto ? 'Uploading...' : profile.avatar_url ? '📷 Change Photo' : '📷 Upload Photo'}
            </button>
            {profile.avatar_url && (
              <button onClick={() => setProfile({ ...profile, avatar_url: '' })} style={{
                marginTop: 6, background: 'none', border: 'none', color: '#EF4444', fontSize: 12, cursor: 'pointer', padding: 0,
              }}>Remove Photo</button>
            )}
          </div>
        </div>
      </div>

      {/* Profile Section */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>
          <span style={{ width: 4, height: 20, background: '#FF8C00', borderRadius: 2, display: 'inline-block' }}></span>
          Profile Information
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Full Name</label>
            <input
              style={inputStyle}
              value={profile.name || ''}
              onChange={e => setProfile({ ...profile, name: e.target.value })}
              placeholder="Your full name"
            />
          </div>
          <div>
            <label style={labelStyle}>Phone Number</label>
            <input
              style={inputStyle}
              value={profile.phone || ''}
              onChange={e => setProfile({ ...profile, phone: e.target.value })}
              placeholder="(555) 123-4567"
            />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input
              style={{ ...inputStyle, background: '#F5F5F5', color: '#999', cursor: 'not-allowed' }}
              value={profile.email || ''}
              disabled
            />
            <span style={{ fontSize: 11, color: '#aaa', marginTop: 2, display: 'block' }}>
              Email cannot be changed
            </span>
          </div>
        </div>
      </div>

      {/* Vehicle Section */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>
          <span style={{ width: 4, height: 20, background: '#FF8C00', borderRadius: 2, display: 'inline-block' }}></span>
          Vehicle Information
        </div>
        <div style={{
          background: '#FFF8F0',
          border: '1px solid #FFE0B2',
          borderRadius: 8,
          padding: '8px 12px',
          marginBottom: 14,
          fontSize: 12,
          color: '#B36B00',
        }}>
          Vehicle info is saved locally on this device.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Vehicle Type</label>
            <select
              style={selectStyle}
              value={vehicle.type}
              onChange={e => setVehicle({ ...vehicle, type: e.target.value })}
            >
              <option value="">Select vehicle type</option>
              <option value="car">Car</option>
              <option value="motorcycle">Motorcycle</option>
              <option value="bicycle">Bicycle</option>
              <option value="scooter">Scooter</option>
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Make</label>
              <input
                style={inputStyle}
                value={vehicle.make}
                onChange={e => setVehicle({ ...vehicle, make: e.target.value })}
                placeholder="e.g. Toyota"
              />
            </div>
            <div>
              <label style={labelStyle}>Model</label>
              <input
                style={inputStyle}
                value={vehicle.model}
                onChange={e => setVehicle({ ...vehicle, model: e.target.value })}
                placeholder="e.g. Camry"
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Color</label>
              <input
                style={inputStyle}
                value={vehicle.color}
                onChange={e => setVehicle({ ...vehicle, color: e.target.value })}
                placeholder="e.g. White"
              />
            </div>
            <div>
              <label style={labelStyle}>License Plate</label>
              <input
                style={inputStyle}
                value={vehicle.licensePlate}
                onChange={e => setVehicle({ ...vehicle, licensePlate: e.target.value })}
                placeholder="e.g. ABC1234"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Payout Settings */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>
          <span style={{ width: 4, height: 20, background: '#10B981', borderRadius: 2, display: 'inline-block' }}></span>
          Payout Settings (Weekly Earnings)
        </div>
        <div style={{
          background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8,
          padding: '8px 12px', marginBottom: 14, fontSize: 12, color: '#166534',
        }}>
          Choose how you want to receive your weekly earnings.
        </div>

        {/* Payout method selector */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Preferred Payout Method</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {[
              { key: 'ach', label: 'Bank ACH', icon: '🏦', desc: 'Free, 1-2 days' },
              { key: 'paypal', label: 'PayPal', icon: '🅿️', desc: 'Instant to PayPal' },
            ].map(m => (
              <button key={m.key} type="button"
                onClick={() => setBankInfo({ ...bankInfo, payout_method: m.key })}
                style={{
                  padding: '10px', borderRadius: 8, textAlign: 'center', cursor: 'pointer',
                  border: bankInfo.payout_method === m.key ? '2px solid #10B981' : '1.5px solid #ddd',
                  background: bankInfo.payout_method === m.key ? '#F0FDF4' : '#fff',
                }}>
                <div style={{ fontSize: 20, marginBottom: 2 }}>{m.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: bankInfo.payout_method === m.key ? '#10B981' : '#333' }}>{m.label}</div>
                <div style={{ fontSize: 10, color: '#999' }}>{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ACH fields */}
        {bankInfo.payout_method === 'ach' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Account Holder Name</label>
              <input style={inputStyle} placeholder="John Doe"
                value={bankInfo.bank_account_holder || ''}
                onChange={e => setBankInfo({ ...bankInfo, bank_account_holder: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>Routing Number</label>
                <input style={inputStyle} placeholder="9 digits"
                  value={bankInfo.bank_routing_number || ''}
                  onChange={e => setBankInfo({ ...bankInfo, bank_routing_number: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Account Number</label>
                <input style={inputStyle} placeholder="Account number" type="password"
                  value={bankInfo.bank_account_number || ''}
                  onChange={e => setBankInfo({ ...bankInfo, bank_account_number: e.target.value })} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Confirm Account Number</label>
              <input style={{
                  ...inputStyle,
                  borderColor: confirmAccountNumber && confirmAccountNumber !== bankInfo.bank_account_number ? '#DC2626' : undefined,
                }} placeholder="Re-enter account number" type="password"
                value={confirmAccountNumber}
                onChange={e => setConfirmAccountNumber(e.target.value)} />
              {confirmAccountNumber && confirmAccountNumber !== bankInfo.bank_account_number && (
                <div style={{ color: '#DC2626', fontSize: 12, marginTop: 4 }}>Account numbers do not match.</div>
              )}
            </div>
          </div>
        )}

        {/* PayPal field */}
        {bankInfo.payout_method === 'paypal' && (
          <div>
            <label style={labelStyle}>PayPal Email</label>
            <input style={inputStyle} placeholder="you@email.com" type="email"
              value={bankInfo.paypal_email || ''}
              onChange={e => setBankInfo({ ...bankInfo, paypal_email: e.target.value })} />
          </div>
        )}

        {/* Venmo field */}
        {bankInfo.payout_method === 'venmo' && (
          <div>
            <label style={labelStyle}>Venmo Username</label>
            <input style={inputStyle} placeholder="@username"
              value={bankInfo.venmo_handle || ''}
              onChange={e => setBankInfo({ ...bankInfo, venmo_handle: e.target.value })} />
          </div>
        )}

        {/* Cash App field */}
        {bankInfo.payout_method === 'cashapp' && (
          <div>
            <label style={labelStyle}>Cash App Tag</label>
            <input style={inputStyle} placeholder="$cashtag"
              value={bankInfo.cashapp_handle || ''}
              onChange={e => setBankInfo({ ...bankInfo, cashapp_handle: e.target.value })} />
          </div>
        )}

        <button
          onClick={async () => {
            if (bankInfo.payout_method === 'ach' && bankInfo.bank_account_number && confirmAccountNumber !== bankInfo.bank_account_number) {
              alert('Account numbers do not match.'); return
            }
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
          style={{
            marginTop: 14, padding: '10px 24px', borderRadius: 8, border: 'none',
            background: savingBank ? '#CCC' : '#10B981', color: '#fff',
            fontSize: 14, fontWeight: 700, cursor: savingBank ? 'not-allowed' : 'pointer',
          }}
        >
          {savingBank ? 'Saving...' : 'Save Payout Info'}
        </button>
        {bankSaved && <div style={{ color: '#10B981', fontSize: 13, fontWeight: 600, marginTop: 8 }}>Payout info saved!</div>}
      </div>

      {/* Save Button */}
      <button
        onClick={save}
        disabled={saving}
        style={{
          width: '100%',
          padding: '14px 32px',
          borderRadius: 10,
          fontSize: 15,
          fontWeight: 700,
          background: saving ? '#CCC' : '#FF8C00',
          color: '#fff',
          border: 'none',
          cursor: saving ? 'not-allowed' : 'pointer',
          transition: 'background 0.2s',
          marginBottom: 8,
        }}
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>

      {saved && (
        <div style={{
          textAlign: 'center',
          color: '#2E7D32',
          fontSize: 14,
          fontWeight: 600,
          padding: '8px 0',
        }}>
          Settings saved successfully!
        </div>
      )}
    </div>
  )
}
