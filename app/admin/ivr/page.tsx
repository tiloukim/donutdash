'use client'

import { useEffect, useState } from 'react'

type Settings = {
  forward_number: string
  business_hours_start: number
  business_hours_end: number
  dial_timeout_seconds: number
  updated_at?: string
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i).map(h => ({
  value: h,
  label: h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`,
}))
// End hour can also be 24 (midnight = open all day)
const END_HOUR_OPTIONS = [...HOUR_OPTIONS.slice(1), { value: 24, label: '12 AM (next day)' }]

export default function AdminIVR() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const fetchSettings = async () => {
    const res = await fetch('/api/admin/ivr-settings')
    const data = await res.json()
    if (data?.settings) setSettings(data.settings)
    setLoading(false)
  }

  useEffect(() => { fetchSettings() }, [])

  const save = async () => {
    if (!settings) return
    setSaving(true)
    setError('')
    setSavedAt(null)
    try {
      const res = await fetch('/api/admin/ivr-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to save')
        return
      }
      setSettings(data.settings)
      setSavedAt(new Date().toLocaleTimeString())
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !settings) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading IVR settings…</div>

  const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, outline: 'none' } as const
  const labelStyle = { fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 0.5 }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>IVR Settings</h2>
        <p style={{ fontSize: 13, color: '#666' }}>
          Settings for the phone IVR at <strong>+1 430-999-0168</strong>. Changes take effect within ~30 seconds.
        </p>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <label style={labelStyle}>Forward Number</label>
          <input
            style={inputStyle}
            value={settings.forward_number}
            onChange={e => setSettings({ ...settings, forward_number: e.target.value })}
            placeholder="+19033455599"
          />
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
            Where extensions 0/2/3/4 ring during business hours. Accepts 10-digit (9033455599) or E.164 (+19033455599).
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Open At</label>
            <select
              style={inputStyle}
              value={settings.business_hours_start}
              onChange={e => setSettings({ ...settings, business_hours_start: parseInt(e.target.value, 10) })}
            >
              {HOUR_OPTIONS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Close At</label>
            <select
              style={inputStyle}
              value={settings.business_hours_end}
              onChange={e => setSettings({ ...settings, business_hours_end: parseInt(e.target.value, 10) })}
            >
              {END_HOUR_OPTIONS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: -8 }}>
          Central Time, 7 days a week. Outside these hours, all extensions go straight to voicemail.
        </div>

        <div>
          <label style={labelStyle}>Dial Timeout (seconds)</label>
          <input
            type="number"
            min={5}
            max={60}
            style={inputStyle}
            value={settings.dial_timeout_seconds}
            onChange={e => setSettings({ ...settings, dial_timeout_seconds: parseInt(e.target.value, 10) || 0 })}
          />
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
            How long the forward number rings before going to voicemail. 5-60 seconds. Keep under your carrier&apos;s voicemail trigger (usually ~22s) so DonutDash voicemail catches the call.
          </div>
        </div>

        {error && (
          <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>{error}</div>
        )}
        {savedAt && !error && (
          <div style={{ background: '#D1FAE5', color: '#065F46', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
            ✓ Saved at {savedAt}. Live within ~30s.
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={save}
            disabled={saving}
            style={{
              padding: '10px 22px', borderRadius: 8, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
              background: saving ? '#ccc' : '#6366F1', color: '#fff', fontSize: 14, fontWeight: 700,
            }}
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 16, fontSize: 12, color: '#9CA3AF' }}>
        Last updated: {settings.updated_at ? new Date(settings.updated_at).toLocaleString() : 'never'}
      </div>
    </div>
  )
}
