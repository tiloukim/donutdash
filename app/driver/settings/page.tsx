'use client'

import { useState, useEffect } from 'react'

export default function DriverSettings() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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
            <label style={labelStyle}>Photo URL</label>
            <input
              style={inputStyle}
              placeholder="https://example.com/photo.jpg"
              value={profile.avatar_url || ''}
              onChange={e => setProfile({ ...profile, avatar_url: e.target.value })}
            />
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
