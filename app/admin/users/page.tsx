'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'

interface UserRow {
  id: string
  auth_id: string
  name: string
  email: string
  phone: string | null
  role: string
  is_active: boolean
  created_at: string
  saved_address?: { address: string; city: string; state: string; zip: string } | null
  last_order_address?: { delivery_address: string; delivery_city: string | null } | null
}

// Display order + labels for the role dropdown. The labels are
// what shows in the UI; the values match dd_users.role exactly.
const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'customer',          label: 'Customer' },
  { value: 'shop_owner',        label: 'Shop Owner' },
  { value: 'driver',            label: 'Driver' },
  { value: 'cashier',           label: 'Cashier' },
  { value: 'marketing_manager', label: 'Marketing Manager' },
  { value: 'field_manager',     label: 'Field Manager' },
  { value: 'general_manager',   label: 'General Manager' },
  { value: 'admin',             label: 'Admin' },
]

export default function AdminUsers() {
  const { role: currentRole } = useAuth()
  // Role changes are admin-only — non-admin managers see a read-only badge instead.
  const canChangeRoles = currentRole === 'admin'

  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', new_password: '' })
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(data => setUsers(data.users || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const updateUser = async (id: string, updates: Record<string, unknown>) => {
    setUpdating(id)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      })
      if (res.ok) {
        const data = await res.json()
        setUsers(prev => prev.map(u => u.id === id ? { ...u, ...data.user } : u))
      }
    } catch { /* ignore */ }
    setUpdating(null)
  }

  const deleteUser = async (u: UserRow) => {
    if (!confirm(`Delete ${u.name} (${u.email})? This permanently removes the account and cannot be undone.`)) return
    setUpdating(u.id)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: u.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setUsers(prev => prev.filter(x => x.id !== u.id))
      } else {
        alert(data.error || 'Failed to delete user')
      }
    } catch {
      alert('Failed to delete user')
    }
    setUpdating(null)
  }

  const openEdit = (u: UserRow) => {
    setEditing(u)
    setEditForm({ name: u.name, email: u.email, phone: u.phone || '', new_password: '' })
    setEditError('')
  }

  const saveEdit = async () => {
    if (!editing) return
    if (!editForm.name.trim() || !editForm.email.trim()) {
      setEditError('Name and email are required')
      return
    }
    setEditSaving(true)
    setEditError('')
    try {
      const updates: Record<string, string> = {}
      if (editForm.name !== editing.name) updates.name = editForm.name.trim()
      if (editForm.email !== editing.email) updates.email = editForm.email.trim()
      if (editForm.phone !== (editing.phone || '')) updates.phone = editForm.phone.trim()
      if (editForm.new_password) updates.new_password = editForm.new_password

      if (Object.keys(updates).length === 0) {
        setEditing(null)
        setEditSaving(false)
        return
      }

      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, ...updates }),
      })
      const data = await res.json()
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === editing.id ? { ...u, ...data.user } : u))
        setEditing(null)
      } else {
        setEditError(data.error || 'Failed to update')
      }
    } catch {
      setEditError('Failed to update')
    }
    setEditSaving(false)
  }

  const filtered = search
    ? users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()) || (u.phone || '').includes(search))
    : users

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>Loading users...</div>

  const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, outline: 'none' } as const

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 14, color: '#6B7280' }}>{filtered.length} users{search ? ` matching "${search}"` : ' total'}</span>
        <input
          type="text"
          placeholder="Search name, email, or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13, width: 260, outline: 'none' }}
        />
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                {['Name', 'Email', 'Phone', 'Role', 'Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid #F3F4F6', opacity: updating === u.id ? 0.5 : 1 }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: 14 }}>{u.name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280' }}>{u.email}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280' }}>{u.phone || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {canChangeRoles ? (
                      <select
                        value={u.role}
                        onChange={e => updateUser(u.id, { role: e.target.value })}
                        style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, background: '#fff', cursor: 'pointer' }}
                      >
                        {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    ) : (
                      <span style={{ fontSize: 13, color: '#374151' }}>
                        {ROLE_OPTIONS.find(r => r.value === u.role)?.label ?? u.role}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: u.is_active ? '#D1FAE5' : '#FEE2E2',
                      color: u.is_active ? '#065F46' : '#991B1B',
                    }}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280' }}>
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px 16px', display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => openEdit(u)}
                      style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => updateUser(u.id, { is_active: !u.is_active })}
                      disabled={updating === u.id}
                      style={{
                        padding: '6px 14px', borderRadius: 6, border: '1px solid #E5E7EB',
                        background: u.is_active ? '#FEF2F2' : '#F0FDF4',
                        color: u.is_active ? '#DC2626' : '#16A34A',
                        cursor: 'pointer', fontSize: 13, fontWeight: 500,
                      }}
                    >
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => deleteUser(u)}
                      disabled={updating === u.id}
                      style={{
                        padding: '6px 14px', borderRadius: 6, border: '1px solid #FCA5A5',
                        background: '#fff', color: '#B91C1C',
                        cursor: 'pointer', fontSize: 13, fontWeight: 500,
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Modal */}
      {editing && (
        <div
          onClick={() => setEditing(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, padding: 28, maxWidth: 440, width: '100%' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Edit User</h3>

            {editError && (
              <div style={{ background: '#FEE2E2', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#DC2626', fontSize: 14 }}>{editError}</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Name</label>
                <input style={inputStyle} value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Email</label>
                <input style={inputStyle} type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Phone</label>
                <input style={inputStyle} type="tel" placeholder="(555) 123-4567" value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Address</label>
                {editing?.saved_address ? (
                  <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span>{[editing.saved_address.address, editing.saved_address.city, editing.saved_address.state, editing.saved_address.zip].filter(Boolean).join(', ')}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', background: '#D1FAE5', padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>Saved</span>
                  </div>
                ) : editing?.last_order_address ? (
                  <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span>{[editing.last_order_address.delivery_address, editing.last_order_address.delivery_city].filter(Boolean).join(', ')}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', background: '#F3F4F6', padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>From last order</span>
                  </div>
                ) : (
                  <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#9CA3AF' }}>No address on file</div>
                )}
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Reset Password</label>
                <input style={inputStyle} type="text" placeholder="Leave blank to keep current password" value={editForm.new_password} onChange={e => setEditForm(p => ({ ...p, new_password: e.target.value }))} />
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Only fill this if you want to change the password</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={saveEdit}
                disabled={editSaving}
                style={{ flex: 1, padding: '12px', borderRadius: 8, border: 'none', background: editSaving ? '#ccc' : '#2563EB', color: '#fff', fontSize: 15, fontWeight: 700, cursor: editSaving ? 'not-allowed' : 'pointer' }}
              >
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={() => setEditing(null)}
                style={{ padding: '12px 20px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', fontSize: 14, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
