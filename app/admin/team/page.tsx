'use client'

import { useEffect, useRef, useState } from 'react'
import AvatarCropper from '@/components/AvatarCropper'

interface TeamMember {
  id: string
  slug: string
  name: string
  title: string
  phone: string
  email: string
  location: string
  photo_url: string | null
  is_active: boolean
  display_order: number
  upload_token: string | null
}

const EMPTY: Omit<TeamMember, 'id'> = {
  slug: '', name: '', title: '', phone: '', email: '',
  location: 'Tyler, Texas', photo_url: null, is_active: true, display_order: 0,
  upload_token: null,
}

export default function AdminTeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<TeamMember | null>(null)
  const [draft, setDraft] = useState<Omit<TeamMember, 'id'>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/team').then(r => r.json()).catch(() => null)
    setMembers(res?.team || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    setDraft({ ...EMPTY })
    setErr('')
  }
  const openEdit = (m: TeamMember) => {
    setEditing(m)
    setDraft(m)
    setErr('')
  }
  const closeModal = () => {
    setEditing(null)
    setDraft(EMPTY)
    setErr('')
  }

  // Determine whether the modal is showing (edit OR create — controlled by `draft.name !== ''` OR explicit editing)
  const modalOpen = editing != null || draft !== EMPTY

  const handleSave = async () => {
    setSaving(true)
    setErr('')
    try {
      const url = '/api/admin/team'
      const method = editing ? 'PATCH' : 'POST'
      const body = editing ? { id: editing.id, ...draft } : draft
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) {
        setErr(data.error || 'Save failed')
      } else {
        await load()
        closeModal()
      }
    } catch (e: any) {
      setErr(e?.message || 'Save failed')
    }
    setSaving(false)
  }

  const handleDelete = async (m: TeamMember) => {
    if (!confirm(`Delete ${m.name}'s card? This cannot be undone.`)) return
    const res = await fetch(`/api/admin/team?id=${m.id}`, { method: 'DELETE' })
    if (res.ok) await load()
  }

  const copyUploadLink = async (m: TeamMember) => {
    if (!m.upload_token) {
      alert('No upload token yet — try refreshing or run the team-upload-token SQL migration.')
      return
    }
    const url = `${window.location.origin}/card/${m.slug}/upload?t=${m.upload_token}`
    try {
      await navigator.clipboard.writeText(url)
      alert(`Copied! Send to ${m.name}:\n\n${url}`)
    } catch {
      prompt('Copy this upload link and send it to ' + m.name, url)
    }
  }

  const regenerateToken = async (m: TeamMember) => {
    if (!confirm(`Regenerate ${m.name}'s upload link? The old link will stop working.`)) return
    const res = await fetch('/api/admin/team', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: m.id, regenerate_token: true }),
    })
    if (res.ok) await load()
  }

  const handleCropped = async (blob: Blob) => {
    setPendingFile(null)
    const formData = new FormData()
    formData.append('file', new File([blob], 'team.jpg', { type: 'image/jpeg' }))
    formData.append('type', 'avatar')
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    const data = await res.json()
    if (res.ok && data.url) {
      setDraft(d => ({ ...d, photo_url: data.url }))
    } else {
      setErr(data.error || 'Photo upload failed')
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>Loading team...</div>

  return (
    <div>
      <style>{`
        .team-page-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
        .team-desktop { display: block; }
        .team-mobile { display: none; }
        @media (max-width: 768px) {
          .team-desktop { display: none; }
          .team-mobile { display: block; }
          .team-page-header h1 { font-size: 20px; }
          .team-page-header .add-btn { width: 100%; padding: 10px; }
        }
      `}</style>

      <div className="team-page-header">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1A1A2E', margin: 0 }}>Team Cards</h1>
          <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>Digital business cards live at <code style={codeStyle}>donutdash.app/card/[slug]</code></p>
        </div>
        <button onClick={openCreate} className="add-btn" style={primaryBtnStyle}>+ Add Member</button>
      </div>

      {/* Mobile: stacked cards */}
      <div className="team-mobile" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {members.map(m => (
          <div key={m.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 14 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: m.photo_url ? `url(${m.photo_url}) center/cover` : 'linear-gradient(135deg, #FF1493, #FF8C00)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 16, fontWeight: 700, flexShrink: 0,
              }}>
                {!m.photo_url && m.name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#1A1A2E' }}>{m.name}</div>
                <div style={{ fontSize: 13, color: '#6B7280' }}>{m.title}</div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                background: m.is_active ? '#D1FAE5' : '#FEE2E2',
                color: m.is_active ? '#065F46' : '#991B1B', flexShrink: 0,
              }}>{m.is_active ? 'Active' : 'Hidden'}</span>
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{m.phone}</div>
            <a href={`/card/${m.slug}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#6366F1', textDecoration: 'none', display: 'inline-block', marginBottom: 12 }}>
              /card/{m.slug} ↗
            </a>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <button onClick={() => openEdit(m)} style={{ ...smallBtnStyle, flex: '1 1 auto' }}>Edit</button>
              <button onClick={() => copyUploadLink(m)} style={{ ...smallBtnStyle, color: '#6366F1', borderColor: '#C7D2FE', flex: '1 1 auto' }}>📷 Upload Link</button>
              <button onClick={() => regenerateToken(m)} style={{ ...smallBtnStyle, color: '#6B7280' }} title="Regenerate upload link">↻</button>
              <button onClick={() => handleDelete(m)} style={{ ...smallBtnStyle, color: '#DC2626' }}>Delete</button>
            </div>
          </div>
        ))}
        {members.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB' }}>
            No team members yet — tap <strong>Add Member</strong> to create the first card.
          </div>
        )}
      </div>

      {/* Desktop: table */}
      <div className="team-desktop" style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                {['Photo', 'Name', 'Title', 'Phone', 'Slug / URL', 'Status', 'Actions'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: m.photo_url ? `url(${m.photo_url}) center/cover` : 'linear-gradient(135deg, #FF1493, #FF8C00)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 14, fontWeight: 700,
                    }}>
                      {!m.photo_url && m.name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 14 }}>{m.name}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: '#6B7280' }}>{m.title}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: '#6B7280' }}>{m.phone}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#6366F1' }}>
                    <a href={`/card/${m.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: '#6366F1', textDecoration: 'none' }}>
                      /card/{m.slug} ↗
                    </a>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                      background: m.is_active ? '#D1FAE5' : '#FEE2E2',
                      color: m.is_active ? '#065F46' : '#991B1B',
                    }}>{m.is_active ? 'Active' : 'Hidden'}</span>
                  </td>
                  <td style={{ padding: '10px 14px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button onClick={() => openEdit(m)} style={smallBtnStyle}>Edit</button>
                    <button onClick={() => copyUploadLink(m)} style={{ ...smallBtnStyle, color: '#6366F1', borderColor: '#C7D2FE' }} title="Copy a self-service link the employee can use to update their own photo">📷 Upload Link</button>
                    <button onClick={() => regenerateToken(m)} style={{ ...smallBtnStyle, color: '#6B7280' }} title="Revoke the old upload link and generate a new one">↻</button>
                    <button onClick={() => handleDelete(m)} style={{ ...smallBtnStyle, color: '#DC2626' }}>Delete</button>
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>No team members yet — click <strong>Add Member</strong> to create the first card.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit/create modal */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 460, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{editing ? 'Edit Member' : 'New Member'}</h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16 }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: draft.photo_url ? `url(${draft.photo_url}) center/cover` : 'linear-gradient(135deg, #FF1493, #FF8C00)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 22, fontWeight: 700, flexShrink: 0,
              }}>
                {!draft.photo_url && (draft.name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase() || 'NEW')}
              </div>
              <div style={{ flex: 1 }}>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) setPendingFile(f)
                    if (fileRef.current) fileRef.current.value = ''
                  }}
                />
                <button onClick={() => fileRef.current?.click()} style={{ ...secondaryBtnStyle, width: '100%' }}>
                  📷 {draft.photo_url ? 'Change Photo' : 'Upload Photo'}
                </button>
                {draft.photo_url && (
                  <button onClick={() => setDraft(d => ({ ...d, photo_url: null }))} style={{ marginTop: 4, background: 'none', border: 'none', color: '#EF4444', fontSize: 12, cursor: 'pointer', padding: 0 }}>Remove photo</button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
              <Field label="Full name *" value={draft.name} onChange={v => setDraft(d => ({ ...d, name: v }))} />
              <Field label="Title *" value={draft.title} onChange={v => setDraft(d => ({ ...d, title: v }))} placeholder="e.g. Founder" />
              <Field label="Phone *" value={draft.phone} onChange={v => setDraft(d => ({ ...d, phone: v }))} placeholder="9035551234" />
              <Field label="Email *" value={draft.email} onChange={v => setDraft(d => ({ ...d, email: v }))} placeholder="name@donutdash.app" />
              <Field label="Location" value={draft.location} onChange={v => setDraft(d => ({ ...d, location: v }))} />
              <Field
                label="Slug (URL)"
                value={draft.slug}
                onChange={v => setDraft(d => ({ ...d, slug: v }))}
                placeholder={draft.name.split(' ')[0] || 'first-name'}
                hint={`Card will live at /card/${draft.slug || draft.name.split(' ')[0] || 'first-name'}`}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', marginTop: 4 }}>
                <input type="checkbox" checked={draft.is_active} onChange={e => setDraft(d => ({ ...d, is_active: e.target.checked }))} />
                Active (card publicly accessible)
              </label>
            </div>

            {err && (
              <div style={{ marginTop: 12, padding: 10, background: '#FEF2F2', color: '#991B1B', borderRadius: 8, fontSize: 13 }}>{err}</div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={closeModal} disabled={saving} style={{ ...secondaryBtnStyle, flex: 1 }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ ...primaryBtnStyle, flex: 1 }}>{saving ? 'Saving...' : editing ? 'Save Changes' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {pendingFile && (
        <AvatarCropper
          file={pendingFile}
          onCancel={() => setPendingFile(null)}
          onCrop={handleCropped}
        />
      )}
    </div>
  )
}

function Field({ label, value, onChange, placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E5E7EB',
          fontSize: 14, outline: 'none', boxSizing: 'border-box',
        }}
      />
      {hint && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

const thStyle: React.CSSProperties = { padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }
const primaryBtnStyle: React.CSSProperties = { padding: '8px 16px', borderRadius: 8, border: 'none', background: '#6366F1', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }
const secondaryBtnStyle: React.CSSProperties = { padding: '8px 16px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const smallBtnStyle: React.CSSProperties = { padding: '4px 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
const codeStyle: React.CSSProperties = { background: '#F3F4F6', padding: '1px 6px', borderRadius: 4, fontSize: 12, color: '#374151' }
