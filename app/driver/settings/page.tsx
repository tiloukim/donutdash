'use client'

import { useState, useEffect } from 'react'

export default function DriverSettings() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/driver/settings').then(r => r.json()).then(setProfile).finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    await fetch('/api/driver/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) })
    setSaving(false)
  }

  if (loading || !profile) return <div>Loading settings...</div>

  const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid #FFE8D6', borderRadius: 8, fontSize: 14 } as const

  return (
    <div style={{ maxWidth: 500 }}>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #FFE8D6', padding: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={{ fontSize: 12, fontWeight: 600, color: '#888', display: 'block', marginBottom: 4 }}>Name</label><input style={inputStyle} value={profile.name || ''} onChange={e => setProfile({ ...profile, name: e.target.value })} /></div>
          <div><label style={{ fontSize: 12, fontWeight: 600, color: '#888', display: 'block', marginBottom: 4 }}>Phone</label><input style={inputStyle} value={profile.phone || ''} onChange={e => setProfile({ ...profile, phone: e.target.value })} /></div>
          <div><label style={{ fontSize: 12, fontWeight: 600, color: '#888', display: 'block', marginBottom: 4 }}>Email</label><input style={inputStyle} value={profile.email || ''} disabled /></div>
        </div>
        <button onClick={save} disabled={saving} style={{ marginTop: 20, padding: '10px 32px', borderRadius: 8, fontSize: 14, fontWeight: 700, background: '#FF8C00', color: '#fff', border: 'none', cursor: 'pointer' }}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
