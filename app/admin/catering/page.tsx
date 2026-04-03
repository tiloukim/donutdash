'use client'

import { useState, useEffect } from 'react'

interface CateringRequest {
  id: string
  customer: { id: string; name: string; email: string; phone: string | null }
  shop: { id: string; name: string; slug: string }
  event_date: string
  event_time: string | null
  guest_count: number | null
  items_description: string
  delivery_address: string | null
  budget: string | null
  phone: string | null
  email: string | null
  status: string
  admin_notes: string | null
  quote_amount: number | null
  created_at: string
}

const STATUSES = ['pending', 'quoted', 'confirmed', 'completed', 'cancelled']
const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  quoted: '#6366F1',
  confirmed: '#10B981',
  completed: '#374151',
  cancelled: '#EF4444',
}

export default function AdminCateringPage() {
  const [requests, setRequests] = useState<CateringRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editStatus, setEditStatus] = useState('')
  const [editQuote, setEditQuote] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/catering')
      .then(r => r.json())
      .then(data => setRequests(data.requests || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)

  function startEdit(req: CateringRequest) {
    setEditingId(req.id)
    setEditStatus(req.status)
    setEditQuote(req.quote_amount?.toString() || '')
    setEditNotes(req.admin_notes || '')
  }

  async function saveEdit() {
    if (!editingId) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/catering', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          status: editStatus,
          quote_amount: editQuote ? Number(editQuote) : null,
          admin_notes: editNotes || null,
        }),
      })
      const data = await res.json()
      if (res.ok && data.request) {
        setRequests(prev => prev.map(r => r.id === editingId ? data.request : r))
      }
    } catch {
      // silent
    } finally {
      setSaving(false)
      setEditingId(null)
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading catering requests...</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Catering Requests ({requests.length})</h2>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['all', ...STATUSES].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.82rem',
              background: filter === s ? '#6366F1' : '#E5E7EB',
              color: filter === s ? '#fff' : '#374151',
              transition: 'all 0.15s',
            }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#888', background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB' }}>
          No catering requests {filter !== 'all' ? `with status "${filter}"` : ''}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map(req => (
            <div key={req.id} style={{
              background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #E5E7EB',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{req.shop?.name}</div>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginTop: 2 }}>
                    Customer: {req.customer?.name} ({req.customer?.email})
                    {req.phone && ` | ${req.phone}`}
                  </div>
                </div>
                <span style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700,
                  color: '#fff', background: STATUS_COLORS[req.status] || '#9CA3AF',
                }}>{req.status}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 12, fontSize: '0.88rem' }}>
                <div><span style={{ color: '#888' }}>Date:</span> {new Date(req.event_date).toLocaleDateString()}</div>
                {req.event_time && <div><span style={{ color: '#888' }}>Time:</span> {req.event_time}</div>}
                {req.guest_count && <div><span style={{ color: '#888' }}>Guests:</span> {req.guest_count}</div>}
                {req.budget && <div><span style={{ color: '#888' }}>Budget:</span> {req.budget}</div>}
                {req.delivery_address && <div><span style={{ color: '#888' }}>Delivery:</span> {req.delivery_address}</div>}
              </div>

              <div style={{ background: '#F9FAFB', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: '0.9rem' }}>
                <strong>Items:</strong> {req.items_description}
              </div>

              {req.quote_amount && (
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#6366F1', marginBottom: 8 }}>
                  Quote: ${req.quote_amount.toFixed(2)}
                </div>
              )}
              {req.admin_notes && (
                <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: 8, fontStyle: 'italic' }}>
                  Notes: {req.admin_notes}
                </div>
              )}

              {editingId === req.id ? (
                <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 12, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Status</label>
                      <select value={editStatus} onChange={e => setEditStatus(e.target.value)} style={{
                        width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: '0.9rem',
                      }}>
                        {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Quote Amount ($)</label>
                      <input type="number" value={editQuote} onChange={e => setEditQuote(e.target.value)} placeholder="0.00" step="0.01" style={{
                        width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: '0.9rem', boxSizing: 'border-box',
                      }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Admin Notes</label>
                    <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} style={{
                      width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box',
                    }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={saveEdit} disabled={saving} style={{
                      padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: '#6366F1', color: '#fff', fontWeight: 600, fontSize: '0.88rem',
                    }}>
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={() => setEditingId(null)} style={{
                      padding: '8px 20px', borderRadius: 8, border: '1px solid #E5E7EB', cursor: 'pointer',
                      background: '#fff', color: '#374151', fontWeight: 600, fontSize: '0.88rem',
                    }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => startEdit(req)} style={{
                  padding: '6px 16px', borderRadius: 8, border: '1px solid #E5E7EB', cursor: 'pointer',
                  background: '#fff', color: '#6366F1', fontWeight: 600, fontSize: '0.85rem', marginTop: 4,
                }}>
                  Edit
                </button>
              )}

              <div style={{ fontSize: '0.78rem', color: '#9CA3AF', marginTop: 8 }}>
                Submitted {new Date(req.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
