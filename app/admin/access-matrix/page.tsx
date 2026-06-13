'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import {
  ADMIN_PAGE_META,
  ALWAYS_ALLOWED_PAGES,
  PAGE_ROLES,
  ROLE_BADGES,
  type AdminPortalRole,
} from '@/lib/admin-auth'

// Color-coded role-access matrix. Admin can flip cells to grant/revoke
// access; other admin portal users see read-only state. Source of truth
// is dd_role_permissions; this page reads via /api/admin/role-permissions.

const ROLE_COLUMNS: AdminPortalRole[] = [
  'admin',
  'general_manager',
  'field_manager',
  'marketing_manager',
]

const GROUP_LABELS: Record<string, string> = {
  overview: 'Overview',
  ops: 'Operations',
  marketing: 'Growth & Marketing',
  admin: 'Admin Only',
}

const GROUP_ORDER = ['overview', 'ops', 'marketing', 'admin'] as const

type Matrix = Record<string, AdminPortalRole[]>

export default function AccessMatrixPage() {
  const { role: currentRole } = useAuth()
  const canEdit = currentRole === 'admin'

  const [matrix, setMatrix] = useState<Matrix | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingCell, setSavingCell] = useState<string | null>(null)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/role-permissions')
      .then(r => r.json())
      .then(data => setMatrix(data.permissions || {}))
      .catch(() => setErrorBanner('Could not load permissions — falling back to defaults.'))
      .finally(() => setLoading(false))
  }, [])

  const pagesByGroup = GROUP_ORDER.map(group => ({
    group,
    pages: (Object.keys(ADMIN_PAGE_META) as (keyof typeof ADMIN_PAGE_META)[])
      .filter(path => ADMIN_PAGE_META[path].group === group),
  }))

  const isCellAllowed = (path: string, role: AdminPortalRole): boolean => {
    if (!matrix) return PAGE_ROLES[path]?.includes(role) ?? false
    return matrix[path]?.includes(role) ?? false
  }

  const cellLocked = (path: string, role: AdminPortalRole): boolean => {
    if (role === 'admin') return true
    if (ALWAYS_ALLOWED_PAGES.includes(path)) return true
    return false
  }

  const toggle = async (path: string, role: AdminPortalRole) => {
    if (!canEdit || !matrix) return
    if (cellLocked(path, role)) return

    const cellKey = `${role}|${path}`
    setSavingCell(cellKey)
    setErrorBanner(null)

    const wasAllowed = isCellAllowed(path, role)
    const nextAllowed = !wasAllowed

    // Optimistic update
    setMatrix(prev => {
      if (!prev) return prev
      const next = { ...prev }
      const current = new Set(next[path] ?? [])
      if (nextAllowed) current.add(role)
      else current.delete(role)
      next[path] = Array.from(current)
      return next
    })

    try {
      const res = await fetch('/api/admin/role-permissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, page_path: path, allowed: nextAllowed }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErrorBanner(data.error || 'Failed to save permission.')
        // Revert
        setMatrix(prev => {
          if (!prev) return prev
          const next = { ...prev }
          const current = new Set(next[path] ?? [])
          if (wasAllowed) current.add(role)
          else current.delete(role)
          next[path] = Array.from(current)
          return next
        })
      }
    } catch {
      setErrorBanner('Network error — change not saved.')
    } finally {
      setSavingCell(null)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 14, color: '#6B7280', maxWidth: 720, lineHeight: 1.5 }}>
          Who can see what in the admin portal. {canEdit
            ? 'Click any cell to grant or revoke access — changes save instantly.'
            : 'Only admins can edit this matrix.'} Your current role column is highlighted.
        </p>
      </div>

      {errorBanner && (
        <div style={{
          background: '#FEE2E2', borderRadius: 8, padding: '10px 14px',
          marginBottom: 16, color: '#991B1B', fontSize: 13,
        }}>
          {errorBanner}
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 600 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                <th style={{
                  padding: '14px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700,
                  color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5,
                  background: '#F9FAFB', position: 'sticky', left: 0, zIndex: 2,
                  borderBottom: '1px solid #E5E7EB',
                }}>
                  Page
                </th>
                {ROLE_COLUMNS.map(role => {
                  const badge = ROLE_BADGES[role]
                  const isCurrent = role === currentRole
                  return (
                    <th key={role} style={{
                      padding: '14px 16px', textAlign: 'center', minWidth: 130,
                      background: isCurrent ? `${badge.color}10` : '#F9FAFB',
                      borderBottom: '1px solid #E5E7EB',
                      borderLeft: '1px solid #F3F4F6',
                    }}>
                      <div style={{
                        display: 'inline-block',
                        background: badge.color, color: '#fff',
                        fontSize: 11, fontWeight: 800,
                        padding: '4px 12px', borderRadius: 6,
                        letterSpacing: 0.5,
                      }}>
                        {badge.label}
                      </div>
                      {isCurrent && (
                        <div style={{ fontSize: 10, color: badge.color, fontWeight: 700, marginTop: 4, letterSpacing: 0.5 }}>
                          YOU
                        </div>
                      )}
                      {role === 'admin' && (
                        <div title="Admin access is locked at the code level" style={{ fontSize: 9, color: '#9CA3AF', marginTop: 2, fontWeight: 600 }}>
                          🔒 LOCKED
                        </div>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={1 + ROLE_COLUMNS.length} style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>
                    Loading permissions...
                  </td>
                </tr>
              ) : (
                pagesByGroup.map(({ group, pages }) => (
                  pages.length === 0 ? null : (
                    <GroupRows
                      key={group}
                      label={GROUP_LABELS[group]}
                      pages={pages}
                      currentRole={currentRole as AdminPortalRole | null}
                      canEdit={canEdit}
                      savingCell={savingCell}
                      isCellAllowed={isCellAllowed}
                      cellLocked={cellLocked}
                      onToggle={toggle}
                    />
                  )
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 20, fontSize: 12, color: '#9CA3AF', lineHeight: 1.6 }}>
        {canEdit ? (
          <>Edits are stored in <code style={{ background: '#F3F4F6', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>dd_role_permissions</code>. Admin access + Dashboard + this page can never be removed (lockout safety).</>
        ) : (
          <>Ask an admin if you need different access.</>
        )}
      </div>
    </div>
  )
}

function GroupRows({
  label,
  pages,
  currentRole,
  canEdit,
  savingCell,
  isCellAllowed,
  cellLocked,
  onToggle,
}: {
  label: string
  pages: (keyof typeof ADMIN_PAGE_META)[]
  currentRole: AdminPortalRole | null
  canEdit: boolean
  savingCell: string | null
  isCellAllowed: (path: string, role: AdminPortalRole) => boolean
  cellLocked: (path: string, role: AdminPortalRole) => boolean
  onToggle: (path: string, role: AdminPortalRole) => void
}) {
  return (
    <>
      <tr>
        <td colSpan={1 + ROLE_COLUMNS.length} style={{
          padding: '12px 20px 6px', background: '#F9FAFB',
          fontSize: 11, fontWeight: 800, color: '#6B7280',
          textTransform: 'uppercase', letterSpacing: 0.8,
          borderTop: '1px solid #E5E7EB',
          borderBottom: '1px solid #F3F4F6',
        }}>
          {label}
        </td>
      </tr>
      {pages.map(path => {
        const meta = ADMIN_PAGE_META[path]
        return (
          <tr key={path} style={{ borderBottom: '1px solid #F9FAFB' }}>
            <td style={{
              padding: '10px 20px', fontSize: 14, fontWeight: 500, color: '#1F2937',
              background: '#fff', position: 'sticky', left: 0, zIndex: 1,
              borderBottom: '1px solid #F3F4F6',
              whiteSpace: 'nowrap',
            }}>
              <span style={{ marginRight: 8 }}>{meta.icon}</span>
              {meta.label}
              <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 8, fontFamily: 'monospace' }}>
                {path}
              </span>
            </td>
            {ROLE_COLUMNS.map(role => {
              const allowed = isCellAllowed(path, role)
              const locked = cellLocked(path, role)
              const badge = ROLE_BADGES[role]
              const isCurrent = role === currentRole
              const cellKey = `${role}|${path}`
              const saving = savingCell === cellKey
              const clickable = canEdit && !locked
              return (
                <td key={role} style={{
                  padding: '8px 16px', textAlign: 'center',
                  background: isCurrent ? `${badge.color}08` : 'transparent',
                  borderLeft: '1px solid #F3F4F6',
                  borderBottom: '1px solid #F3F4F6',
                }}>
                  <button
                    onClick={clickable ? () => onToggle(path, role) : undefined}
                    disabled={!clickable || saving}
                    title={
                      locked && role === 'admin' ? 'Admin always has access'
                      : locked ? 'This page must stay accessible to all admin portal roles'
                      : !canEdit ? 'Only admins can edit access'
                      : allowed ? 'Click to remove access'
                      : 'Click to grant access'
                    }
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 32, height: 32, borderRadius: 8,
                      border: 'none', padding: 0,
                      background: allowed ? badge.color : '#F3F4F6',
                      color: allowed ? '#fff' : '#D1D5DB',
                      fontSize: 16, fontWeight: 800,
                      cursor: clickable ? (saving ? 'wait' : 'pointer') : 'default',
                      opacity: saving ? 0.5 : 1,
                      transition: 'all 0.12s',
                      outline: 'none',
                    }}
                    onMouseEnter={e => {
                      if (clickable && !saving) e.currentTarget.style.transform = 'scale(1.1)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'scale(1)'
                    }}
                  >
                    {allowed ? '✓' : '—'}
                  </button>
                </td>
              )
            })}
          </tr>
        )
      })}
    </>
  )
}
