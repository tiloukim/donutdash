'use client'

import { useState, useEffect } from 'react'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function ShopHours() {
  const [hours, setHours] = useState(DAYS.map((_, i) => ({ day_of_week: i, open_time: '06:00', close_time: '18:00', is_closed: false })))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/shop/hours').then(r => r.json()).then(data => {
      if (data.length > 0) setHours(DAYS.map((_, i) => data.find((h: any) => h.day_of_week === i) || { day_of_week: i, open_time: '06:00', close_time: '18:00', is_closed: false }))
    }).finally(() => setLoading(false))
  }, [])

  const update = (idx: number, field: string, value: any) => {
    setHours(prev => prev.map((h, i) => i === idx ? { ...h, [field]: value } : h))
  }

  const save = async () => {
    setSaving(true)
    await fetch('/api/shop/hours', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(hours) })
    setSaving(false)
  }

  if (loading) return <div>Loading hours...</div>

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #FFE4EF', overflow: 'hidden' }}>
        {hours.map((h, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: i < 6 ? '1px solid #FFF0F5' : 'none', opacity: h.is_closed ? 0.5 : 1 }}>
            <span style={{ width: 90, fontWeight: 600, fontSize: 14 }}>{DAYS[i]}</span>
            <input type="time" value={h.open_time} onChange={e => update(i, 'open_time', e.target.value)} disabled={h.is_closed} style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 }} />
            <span style={{ color: '#888' }}>to</span>
            <input type="time" value={h.close_time} onChange={e => update(i, 'close_time', e.target.value)} disabled={h.is_closed} style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 }} />
            <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
              <input type="checkbox" checked={h.is_closed} onChange={e => update(i, 'is_closed', e.target.checked)} /> Closed
            </label>
          </div>
        ))}
      </div>
      <button onClick={save} disabled={saving} style={{ marginTop: 16, padding: '10px 32px', borderRadius: 8, fontSize: 14, fontWeight: 700, background: '#FF1493', color: '#fff', border: 'none', cursor: 'pointer' }}>
        {saving ? 'Saving...' : 'Save Hours'}
      </button>
    </div>
  )
}
