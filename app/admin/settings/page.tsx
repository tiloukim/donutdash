'use client'

import { useEffect, useState } from 'react'

interface SettingField {
  key: string
  label: string
  suffix: string
  defaultValue: string
}

const FIELDS: SettingField[] = [
  { key: 'service_fee_rate', label: 'Service Fee Rate', suffix: '%', defaultValue: '15' },
  { key: 'default_delivery_fee', label: 'Default Delivery Fee', suffix: '$', defaultValue: '3.99' },
  { key: 'driver_base_pay', label: 'Driver Base Pay (per delivery)', suffix: '$', defaultValue: '5.00' },
  { key: 'min_order_amount', label: 'Minimum Order Amount', suffix: '$', defaultValue: '10' },
]

export default function AdminSettings() {
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(data => {
        const loaded: Record<string, string> = {}
        for (const field of FIELDS) {
          loaded[field.key] = data.settings?.[field.key] ?? field.defaultValue
        }
        setValues(loaded)
      })
      .catch(() => {
        const defaults: Record<string, string> = {}
        for (const field of FIELDS) defaults[field.key] = field.defaultValue
        setValues(defaults)
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: values }),
      })
      if (res.ok) {
        setMessage('Settings saved successfully!')
      } else {
        setMessage('Failed to save settings.')
      }
    } catch {
      setMessage('Failed to save settings.')
    }
    setSaving(false)
    setTimeout(() => setMessage(''), 3000)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>Loading settings...</div>

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{
        background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 32,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, color: '#1A1A2E' }}>Platform Settings</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {FIELDS.map(field => (
            <div key={field.key}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                {field.label}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {field.suffix === '$' && <span style={{ fontSize: 16, color: '#6B7280', fontWeight: 500 }}>$</span>}
                <input
                  type="number"
                  step="0.01"
                  value={values[field.key] || ''}
                  onChange={e => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #D1D5DB',
                    fontSize: 15, outline: 'none',
                  }}
                />
                {field.suffix === '%' && <span style={{ fontSize: 16, color: '#6B7280', fontWeight: 500 }}>%</span>}
              </div>
            </div>
          ))}
        </div>

        {message && (
          <div style={{
            marginTop: 16, padding: '10px 14px', borderRadius: 8, fontSize: 14, fontWeight: 500,
            background: message.includes('success') ? '#D1FAE5' : '#FEE2E2',
            color: message.includes('success') ? '#065F46' : '#991B1B',
          }}>
            {message}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            marginTop: 24, width: '100%', padding: '12px 24px', borderRadius: 8,
            background: saving ? '#A5B4FC' : '#6366F1', color: '#fff',
            border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: 15, fontWeight: 600,
          }}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
