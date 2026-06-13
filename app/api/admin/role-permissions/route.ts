import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  ALWAYS_ALLOWED_PAGES,
  applyPermissionGuards,
  canAccessAdminPortal,
  isAdmin,
  PAGE_ROLES,
  type AdminPortalRole,
} from '@/lib/admin-auth'

const VALID_ROLES = new Set<AdminPortalRole>([
  'admin',
  'general_manager',
  'field_manager',
  'marketing_manager',
])

// GET — return the effective matrix as { [page_path]: roles[] }.
// Any admin portal user can read so the matrix viewer + sidebar
// nav filter both have data. The lockout guards (admin always,
// always-allowed pages) are applied here so the response can be
// used directly without further massaging.
export async function GET() {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: profile } = await svc
    .from('dd_users')
    .select('role')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!profile || !canAccessAdminPortal(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: rows } = await svc
    .from('dd_role_permissions')
    .select('role, page_path')

  // Seed every known page so the matrix UI can render even pages
  // with zero rows (just admin will show as checked).
  const matrix: Record<string, AdminPortalRole[]> = {}
  for (const path of Object.keys(PAGE_ROLES)) matrix[path] = []
  for (const row of rows ?? []) {
    if (!VALID_ROLES.has(row.role as AdminPortalRole)) continue
    if (!matrix[row.page_path]) matrix[row.page_path] = []
    matrix[row.page_path].push(row.role as AdminPortalRole)
  }

  return NextResponse.json({ permissions: applyPermissionGuards(matrix) })
}

// PATCH — flip a single cell. Admin-only. Body: { role, page_path, allowed }.
// Server refuses to remove admin role or unlock the lockout-protected pages
// so a hostile/sloppy admin can't soft-brick the portal.
export async function PATCH(req: NextRequest) {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: profile } = await svc
    .from('dd_users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!profile || !isAdmin(profile.role)) {
    return NextResponse.json({ error: 'Only admins can edit access' }, { status: 403 })
  }

  const body = await req.json()
  const role = body.role as AdminPortalRole
  const pagePath = body.page_path as string
  const allowed = !!body.allowed

  if (!VALID_ROLES.has(role)) {
    return NextResponse.json({ error: `Invalid role: ${role}` }, { status: 400 })
  }
  if (!PAGE_ROLES[pagePath]) {
    return NextResponse.json({ error: `Unknown page: ${pagePath}` }, { status: 400 })
  }
  if (role === 'admin' && !allowed) {
    return NextResponse.json({ error: 'Admin access cannot be removed' }, { status: 400 })
  }
  if (!allowed && ALWAYS_ALLOWED_PAGES.includes(pagePath)) {
    return NextResponse.json(
      { error: `${pagePath} must stay accessible to all admin portal roles` },
      { status: 400 },
    )
  }

  if (allowed) {
    const { error } = await svc
      .from('dd_role_permissions')
      .upsert({ role, page_path: pagePath, granted_by: profile.id }, { onConflict: 'role,page_path' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await svc
      .from('dd_role_permissions')
      .delete()
      .eq('role', role)
      .eq('page_path', pagePath)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, role, page_path: pagePath, allowed })
}
