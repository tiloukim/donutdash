import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()
    const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
    if (!ddUser || ddUser.role !== 'admin' && ddUser.role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
    if (!ddUser || ddUser.role !== 'admin' && ddUser.role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { id, role, is_active, name, email, phone, new_password } = body

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
