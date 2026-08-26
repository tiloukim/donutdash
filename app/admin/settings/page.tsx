'use client'

import { useEffect, useState } from 'react'

interface SettingField {
  key: string
  label: string
  suffix: string
  defaultValue: string
}

const FIELDS: SettingField[] = [
  { key: 'service_fee_rate', label: 'Service Fee Rate', suffix: '%', defaultValue: '10' },
  { key: 'default_delivery_fee', label: 'Default Delivery Fee', suffix: '$', defaultValue: '3.99' },
  { key: 'delivery_free_miles', label: 'Free Delivery Miles (base fee covers this radius)', suffix: 'mi', defaultValue: '5' },
  { key: 'delivery_per_extra_mile', label: 'Delivery Fee — Per Extra Mile', suffix: '$', defaultValue: '1.50' },
  { key: 'driver_base_pay', label: 'Driver Base Pay (per delivery)', suffix: '$', defaultValue: '3.00' },
  { key: 'driver_per_mile', label: 'Driver Per-Mile Rate', suffix: '$', defaultValue: '0.75' },
  { key: 'shop_commission_rate', label: 'Shop Commission Rate', suffix: '%', defaultValue: '20' },
  { key: 'min_order_amount', label: 'Minimum Order Amount', suffix: '$', defaultValue: '10' },
]

// Welcome promo (platform-wide first-order discount). Stored in the same
// dd_platform_settings key/value table; read by lib/promo.ts at checkout.
const WELCOME_DEFAULTS: Record<string, string> = {
  welcome_promo_enabled: 'false',
  welcome_promo_type: 'percent',
  welcome_promo_value: '10',
  welcome_promo_code: 'WELCOME',
  welcome_promo_max_discount: '0',
  welcome_promo_free_delivery: 'false',
}

// Customer referral program ($5 credit). Read by lib/referral.ts; defaults off.
const REFERRAL_DEFAULTS: Record<string, string> = {
  referral_program_enabled: 'false',
}

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
        for (const key of Object.keys(WELCOME_DEFAULTS)) {
          loaded[key] = data.settings?.[key] ?? WELCOME_DEFAULTS[key]
        }
        for (const key of Object.keys(REFERRAL_DEFAULTS)) {
          loaded[key] = data.settings?.[key] ?? REFERRAL_DEFAULTS[key]
        }
        setValues(loaded)
      })
      .catch(() => {
        const defaults: Record<string, string> = {}
        for (const field of FIELDS) defaults[field.key] = field.defaultValue
        for (const key of Object.keys(WELCOME_DEFAULTS)) defaults[key] = WELCOME_DEFAULTS[key]
        for (const key of Object.keys(REFERRAL_DEFAULTS)) defaults[key] = REFERRAL_DEFAULTS[key]
        setValues(defaults)
      })
      .finally(() => setLoading(false))
  }, [])

  const set = (key: string, value: string) => setValues(prev => ({ ...prev, [key]: value }))

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

  const promoEnabled = values.welcome_promo_enabled === 'true'
  const promoType = values.welcome_promo_type === 'amount' ? 'amount' : 'percent'
  const referralEnabled = values.referral_program_enabled === 'true'

  return (
    <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 24 }}>
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
                  onChange={e => set(field.key, e.target.value)}
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
      </div>

      {/* Welcome promo */}
      <div style={{
        background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 32,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1A1A2E' }}>New-Customer Welcome Offer</h2>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={promoEnabled}
              onChange={e => set('welcome_promo_enabled', e.target.checked ? 'true' : 'false')}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 14, fontWeight: 600, color: promoEnabled ? '#065F46' : '#6B7280' }}>
              {promoEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </div>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: 0, marginBottom: 24 }}>
          Auto-applies to a customer&apos;s first order across DonutDash. Customers can also enter the code below.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, opacity: promoEnabled ? 1 : 0.5 }}>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Discount Type
            </label>
            <select
              value={promoType}
              onChange={e => set('welcome_promo_type', e.target.value)}
              disabled={!promoEnabled}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #D1D5DB',
                fontSize: 15, outline: 'none', background: '#fff',
              }}
            >
              <option value="percent">Percentage off</option>
              <option value="amount">Fixed dollar amount off</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              {promoType === 'percent' ? 'Percentage' : 'Amount'}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {promoType === 'amount' && <span style={{ fontSize: 16, color: '#6B7280', fontWeight: 500 }}>$</span>}
              <input
                type="number"
                step="0.01"
                value={values.welcome_promo_value || ''}
                onChange={e => set('welcome_promo_value', e.target.value)}
                disabled={!promoEnabled}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #D1D5DB',
                  fontSize: 15, outline: 'none',
                }}
              />
              {promoType === 'percent' && <span style={{ fontSize: 16, color: '#6B7280', fontWeight: 500 }}>%</span>}
            </div>
          </div>

          {promoType === 'percent' && (
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Max Discount Cap <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(0 = no cap)</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16, color: '#6B7280', fontWeight: 500 }}>$</span>
                <input
                  type="number"
                  step="0.01"
                  value={values.welcome_promo_max_discount || ''}
                  onChange={e => set('welcome_promo_max_discount', e.target.value)}
                  disabled={!promoEnabled}
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #D1D5DB',
                    fontSize: 15, outline: 'none',
                  }}
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Promo Code <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(shown to customers; blank = code optional)</span>
            </label>
            <input
              type="text"
              value={values.welcome_promo_code || ''}
              onChange={e => set('welcome_promo_code', e.target.value.toUpperCase())}
              disabled={!promoEnabled}
              placeholder="WELCOME"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #D1D5DB',
                fontSize: 15, outline: 'none', textTransform: 'uppercase',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600, color: '#374151', cursor: promoEnabled ? 'pointer' : 'default' }}>
              <input
                type="checkbox"
                checked={values.welcome_promo_free_delivery === 'true'}
                onChange={e => set('welcome_promo_free_delivery', e.target.checked ? 'true' : 'false')}
                disabled={!promoEnabled}
                style={{ width: 18, height: 18, accentColor: '#EC4899' }}
              />
              Also waive the delivery fee on the first order
            </label>
            <p style={{ margin: '6px 0 0 28px', fontSize: 12, color: '#9CA3AF' }}>
              The driver is still paid in full (base + per-mile + tip) from the weekly payout — this only reduces the platform&apos;s take.
            </p>
          </div>
        </div>
      </div>

      {/* Referral program */}
      <div style={{
        background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 32,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1A1A2E' }}>Customer Referral Program</h2>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={referralEnabled}
              onChange={e => set('referral_program_enabled', e.target.checked ? 'true' : 'false')}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 14, fontWeight: 600, color: referralEnabled ? '#065F46' : '#6B7280' }}>
              {referralEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </div>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: 0, marginBottom: 0 }}>
          Gives the referrer and the new customer $5 each after the new customer&apos;s first delivered order.
          When off, no new credits accrue and the referral section is hidden from customer profiles.
          Existing credit balances are left untouched.
        </p>
      </div>

      {message && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, fontSize: 14, fontWeight: 500,
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
          width: '100%', padding: '12px 24px', borderRadius: 8,
          background: saving ? '#A5B4FC' : '#6366F1', color: '#fff',
          border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
          fontSize: 15, fontWeight: 600,
        }}
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  )
}
