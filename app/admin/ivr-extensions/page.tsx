'use client'

import { useEffect, useState } from 'react'

type Ext = {
  id: string
  extension: string
  name: string
  phone_number: string
  voicemail_only: boolean
  active: boolean
  updated_at: string
}

const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, outline: 'none' } as const
const labelStyle = { fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: 0.5 }

function formatPhone(p: string) {
  const d = p.replace(/[^\d]/g, '')
  if (d.length === 11 && d.startsWith('1')) return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  return p
}

export default function AdminIvrExtensions() {
  const [exts, setExts] = useState<Ext[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Ext> | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchAll = async () => {
    const res = await fetch('/api/admin/ivr-extensions')
    const data = await res.json()
    if (data?.extensions) setExts(data.extensions)
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const openNew = () => {
    setEditing({ extension: '', name: '', phone_number: '', voicemail_only: false, active: true })
    setError('')
  }

  const openEdit = (e: Ext) => {
    setEditing({ ...e })
    setError('')
  }

  const save = async () => {
    if (!editing) return
    setSaving(true)
    setError('')
    const isNew = !editing.id
    try {
      const res = await fetch('/api/admin/ivr-extensions', {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed')
        return
      }
      await fetchAll()
      setEditing(null)
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (e: Ext) => {
    if (!confirm(`Delete extension ${e.extension} (${e.name})?`)) return
    const res = await fetch('/api/admin/ivr-extensions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: e.id }),
    })
    if (res.ok) setExts(prev => prev.filter(x => x.id !== e.id))
  }

  const toggleActive = async (e: Ext) => {
    const res = await fetch('/api/admin/ivr-extensions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: e.id, active: !e.active }),
    })
    if (res.ok) {
      const data = await res.json()
      setExts(prev => prev.map(x => x.id === e.id ? data.extension : x))
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading extensions…</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>IVR Extensions</h2>
          <p style={{ fontSize: 13, color: '#666' }}>
            Direct-dial extensions on +1 430-999-0168. Callers can dial 2-4 digit extensions at any time during the main menu.
          </p>
        </div>
        <button onClick={openNew} style={{
          padding: '10px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: '#6366F1', color: '#fff', fontSize: 14, fontWeight: 700,
        }}>
          + Add Extension
        </button>
      </div>

      {exts.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: '#888', border: '1px solid #E5E7EB' }}>
          No extensions yet. Add one to let callers dial directly.
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                {['Ext', 'Name', 'Phone', 'Mode', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {exts.map(e => (
                <tr key={e.id} style={{ borderBottom: '1px solid #F3F4F6', opacity: e.active ? 1 : 0.5 }}>
                  <td style={{ padding: '12px 14px', fontWeight: 800, fontSize: 16, color: '#6366F1' }}>{e.extension}</td>
                  <td style={{ padding: '12px 14px', fontWeight: 600 }}>{e.name}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: '#4B5563' }}>{formatPhone(e.phone_number)}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 10,
                      background: e.voicemail_only ? '#FEF3C7' : '#D1FAE5',
                      color: e.voicemail_only ? '#92400E' : '#065F46',
                    }}>
                      {e.voicemail_only ? 'VOICEMAIL ONLY' : 'RINGS PHONE'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <button onClick={() => toggleActive(e)} style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10,
                      background: e.active ? '#D1FAE5' : '#FEE2E2',
                      color: e.active ? '#065F46' : '#991B1B',
                      border: 'none', cursor: 'pointer',
                    }}>
                      {e.active ? 'ACTIVE' : 'INACTIVE'}
                    </button>
                  </td>
                  <td style={{ padding: '12px 14px', display: 'flex', gap: 6 }}>
                    <button onClick={() => openEdit(e)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                    <button onClick={() => remove(e)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #FCA5A5', background: '#fff', color: '#DC2626', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div onClick={() => !saving && setEditing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={ev => ev.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 460 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>{editing.id ? 'Edit Extension' : 'New Extension'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>Extension (2-4 digits)</label>
                <input
                  style={inputStyle}
                  value={editing.extension || ''}
                  onChange={ev => setEditing({ ...editing, extension: ev.target.value })}
                  placeholder="100"
                  maxLength={4}
                />
              </div>
              <div>
                <label style={labelStyle}>Name</label>
                <input style={inputStyle} value={editing.name || ''} onChange={ev => setEditing({ ...editing, name: ev.target.value })} placeholder="John Smith" />
              </div>
              <div>
                <label style={labelStyle}>Phone Number</label>
                <input style={inputStyle} value={editing.phone_number || ''} onChange={ev => setEditing({ ...editing, phone_number: ev.target.value })} placeholder="(430) 555-1234" />
              </div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, fontWeight: 600 }}>
                <input type="checkbox" checked={!!editing.voicemail_only} onChange={ev => setEditing({ ...editing, voicemail_only: ev.target.checked })} />
                Voicemail-only (callers go straight to leaving a message)
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, fontWeight: 600 }}>
                <input type="checkbox" checked={editing.active !== false} onChange={ev => setEditing({ ...editing, active: ev.target.checked })} />
                Active
              </label>
            </div>

            {error && <div style={{ marginTop: 12, background: '#FEE2E2', color: '#991B1B', padding: '8px 12px', borderRadius: 8, fontSize: 13 }}>{error}</div>}

            <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditing(null)} disabled={saving} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: saving ? '#ccc' : '#6366F1', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving…' : (editing.id ? 'Save Changes' : 'Create Extension')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
