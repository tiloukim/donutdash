'use client'

import { useEffect, useState } from 'react'

interface UserRow {
  id: string
  name: string
  email: string
  role: string
  is_active: boolean
  created_at: string
}

const ROLES = ['customer', 'shop_owner', 'driver', 'admin']

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(data => setUsers(data.users || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const updateUser = async (id: string, updates: { role?: string; is_active?: boolean }) => {
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

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>Loading users...</div>

  return (
    <div>
      <div style={{ marginBottom: 16, fontSize: 14, color: '#6B7280' }}>{users.length} users total</div>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                {['Name', 'Email', 'Role', 'Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid #F3F4F6', opacity: updating === u.id ? 0.5 : 1 }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: 14 }}>{u.name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280' }}>{u.email}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <select
                      value={u.role}
                      onChange={e => updateUser(u.id, { role: e.target.value })}
                      style={{
                        padding: '4px 8px', borderRadius: 6, border: '1px solid #D1D5DB',
                        fontSize: 13, background: '#fff', cursor: 'pointer',
                      }}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
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
                  <td style={{ padding: '12px 16px' }}>
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
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
