import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canAccessAdminPortal, isAdmin } from '@/lib/admin-auth'

// Roles a caller may assign via this endpoint. Mirrors the
// dd_users_role_check constraint so a malformed value 400s
// before hitting the DB.
const ASSIGNABLE_ROLES = new Set([
  'customer',
  'shop_owner',
  'driver',
  'cashier',
  'admin',
  'general_manager',
  'field_manager',
  'marketing_manager',
])

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()
    const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
    if (!ddUser || !canAccessAdminPortal(ddUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: users, error } = await svc
      .from('dd_users')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ users: users || [] })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()
    const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
    if (!ddUser || !canAccessAdminPortal(ddUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { id, role, is_active, name, email, phone, new_password } = body

    // Privilege escalation guard: only admin can change roles. A
    // general_manager could otherwise self-promote to admin.
    if (role !== undefined && !isAdmin(ddUser.role)) {
      return NextResponse.json({ error: 'Only admins can change roles' }, { status: 403 })
    }
    if (role !== undefined && !ASSIGNABLE_ROLES.has(role)) {
      return NextResponse.json({ error: `Invalid role: ${role}` }, { status: 400 })
    }
    // Same threat model: a non-admin manager rotating another admin's
    // email or password could lock the admin out. Gate both to admin-only.
    if ((email !== undefined || new_password !== undefined) && !isAdmin(ddUser.role)) {
      return NextResponse.json({ error: 'Only admins can change email or password' }, { status: 403 })
    }

    // Fetch the user first
    const { data: targetUser } = await svc.from('dd_users').select('*').eq('id', id).single()
    if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const updateData: Record<string, unknown> = {}
    if (role !== undefined) updateData.role = role
    if (is_active !== undefined) updateData.is_active = is_active
    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email
    if (phone !== undefined) updateData.phone = phone

    let updatedUser = targetUser

    // Only update dd_users if there are fields to update
    if (Object.keys(updateData).length > 0) {
      const { data: updatedRows, error } = await svc
        .from('dd_users')
        .update(updateData)
        .eq('id', id)
        .select()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (updatedRows && updatedRows.length > 0) updatedUser = updatedRows[0]
    }

    // Update Supabase Auth email if changed
    if (email && updatedUser.auth_id) {
      await svc.auth.admin.updateUserById(updatedUser.auth_id, { email })
    }

    // Reset password if requested
    if (new_password && updatedUser.auth_id) {
      const { error: pwErr } = await svc.auth.admin.updateUserById(updatedUser.auth_id, { password: new_password })
      if (pwErr) return NextResponse.json({ error: 'Profile updated but password reset failed: ' + pwErr.message }, { status: 500 })
    }

    return NextResponse.json({ user: updatedUser })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()
    const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
    if (!ddUser || !canAccessAdminPortal(ddUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Deleting a user is admin-only — a manager could otherwise
    // nuke the admin account and lock everyone out.
    if (!isAdmin(ddUser.role)) {
      return NextResponse.json({ error: 'Only admins can delete users' }, { status: 403 })
    }

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'Missing user id' }, { status: 400 })

    const { data: targetUser } = await svc.from('dd_users').select('*').eq('id', id).single()
    if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    if (targetUser.auth_id === user.id) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
    }

    const { error: dbErr } = await svc.from('dd_users').delete().eq('id', id)
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

    if (targetUser.auth_id) {
      const { error: authErr } = await svc.auth.admin.deleteUser(targetUser.auth_id)
      if (authErr) return NextResponse.json({ error: 'User row deleted but auth deletion failed: ' + authErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
