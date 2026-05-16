'use client'

import { useEffect, useState } from 'react'

type Voicemail = {
  id: string
  caller_number: string
  recording_url: string
  duration_seconds: number
  received_at: string
  listened_at: string | null
  notes: string | null
  for_extension: string | null
  for_extension_name: string | null
}

function formatDuration(seconds: number) {
  if (!seconds) return '0s'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (isToday) return `Today ${time}`
  if (isYesterday) return `Yesterday ${time}`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` ${time}`
}

function formatCaller(num: string) {
  // Render +14305551234 → (430) 555-1234
  const cleaned = num.replace(/[^\d]/g, '')
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  return num
}

export default function AdminVoicemails() {
  const [voicemails, setVoicemails] = useState<Voicemail[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('unread')
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState('')

  const fetchAll = async () => {
    const res = await fetch('/api/admin/voicemails')
    const data = await res.json()
    if (data?.voicemails) setVoicemails(data.voicemails)
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const toggleListened = async (vm: Voicemail) => {
    const willBeListened = !vm.listened_at
    const res = await fetch('/api/admin/voicemails', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: vm.id, listened: willBeListened }),
    })
    if (res.ok) {
      const data = await res.json()
      setVoicemails(prev => prev.map(v => v.id === vm.id ? data.voicemail : v))
    }
  }

  const saveNotes = async (id: string) => {
    const res = await fetch('/api/admin/voicemails', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, notes: notesDraft }),
    })
    if (res.ok) {
      const data = await res.json()
      setVoicemails(prev => prev.map(v => v.id === id ? data.voicemail : v))
      setEditingNotes(null)
    }
  }

  const deleteVm = async (id: string) => {
    if (!confirm('Delete this voicemail? The audio stays on Telnyx for 30 days but disappears here.')) return
    const res = await fetch('/api/admin/voicemails', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) setVoicemails(prev => prev.filter(v => v.id !== id))
  }

  const unreadCount = voicemails.filter(v => !v.listened_at).length
  const shown = filter === 'unread' ? voicemails.filter(v => !v.listened_at) : voicemails

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading voicemails…</div>

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>Voicemails</h2>
        <p style={{ fontSize: 13, color: '#666' }}>
          Messages left on the IVR (430-999-0168) — outside business hours or when no rep picks up.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setFilter('unread')} style={{
          padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
          background: filter === 'unread' ? '#6366F1' : '#fff', color: filter === 'unread' ? '#fff' : '#374151',
          boxShadow: filter === 'unread' ? '0 2px 8px rgba(99,102,241,0.3)' : '0 1px 2px rgba(0,0,0,0.05)',
        }}>
          Unread {unreadCount > 0 && <span style={{ marginLeft: 4, opacity: 0.85 }}>({unreadCount})</span>}
        </button>
        <button onClick={() => setFilter('all')} style={{
          padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
          background: filter === 'all' ? '#6366F1' : '#fff', color: filter === 'all' ? '#fff' : '#374151',
          boxShadow: filter === 'all' ? '0 2px 8px rgba(99,102,241,0.3)' : '0 1px 2px rgba(0,0,0,0.05)',
        }}>
          All ({voicemails.length})
        </button>
      </div>

      {shown.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: '#888', border: '1px solid #E5E7EB' }}>
          {filter === 'unread' ? 'No unread voicemails.' : 'No voicemails yet.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {shown.map(vm => {
            const isUnread = !vm.listened_at
            return (
              <div key={vm.id} style={{
                background: '#fff', borderRadius: 12, padding: 16,
                border: isUnread ? '2px solid #6366F1' : '1px solid #E5E7EB',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isUnread && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366F1', display: 'inline-block' }} />}
                      <a href={`tel:${vm.caller_number}`} style={{ fontWeight: 800, fontSize: 16, color: '#1A1A2E', textDecoration: 'none' }}>
                        {formatCaller(vm.caller_number)}
                      </a>
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                      {formatDate(vm.received_at)} · {formatDuration(vm.duration_seconds)}
                      {vm.for_extension && (
                        <> · <span style={{ background: '#EEF2FF', color: '#3730A3', padding: '2px 8px', borderRadius: 10, fontWeight: 700, fontSize: 11 }}>
                          For ext {vm.for_extension}{vm.for_extension_name ? ` — ${vm.for_extension_name}` : ''}
                        </span></>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => toggleListened(vm)} style={{
                      padding: '6px 12px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff',
                      color: isUnread ? '#374151' : '#6366F1', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}>
                      {isUnread ? 'Mark as listened' : '✓ Listened'}
                    </button>
                    <button onClick={() => deleteVm(vm.id)} style={{
                      padding: '6px 10px', borderRadius: 6, border: '1px solid #FCA5A5', background: '#fff',
                      color: '#DC2626', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}>
                      ✕
                    </button>
                  </div>
                </div>

                {vm.recording_url && vm.recording_url !== 'pending' ? (
                  <audio
                    controls
                    src={vm.recording_url}
                    style={{ width: '100%', height: 36 }}
                    onPlay={() => { if (isUnread) toggleListened(vm) }}
                  />
                ) : (
                  <div style={{ padding: '10px 12px', background: '#FEF3C7', color: '#92400E', borderRadius: 6, fontSize: 12 }}>
                    Recording pending — Telnyx posted the webhook but no audio URL yet. Check Telnyx call log.
                  </div>
                )}

                {editingNotes === vm.id ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      autoFocus
                      value={notesDraft}
                      onChange={e => setNotesDraft(e.target.value)}
                      placeholder="Add a note..."
                      style={{ flex: 1, padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13 }}
                    />
                    <button onClick={() => saveNotes(vm.id)} style={{ padding: '8px 12px', borderRadius: 6, border: 'none', background: '#6366F1', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Save</button>
                    <button onClick={() => setEditingNotes(null)} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                  </div>
                ) : (
                  <div
                    onClick={() => { setEditingNotes(vm.id); setNotesDraft(vm.notes || '') }}
                    style={{
                      fontSize: 13, color: vm.notes ? '#374151' : '#9CA3AF', fontStyle: vm.notes ? 'normal' : 'italic',
                      cursor: 'pointer', padding: '4px 0',
                    }}
                  >
                    {vm.notes || 'Click to add a note…'}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
