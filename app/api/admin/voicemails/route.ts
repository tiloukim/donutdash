import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canAccessAdminPortal } from '@/lib/admin-auth'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('role').eq('auth_id', user.id).single()
  if (!ddUser || (!canAccessAdminPortal(ddUser.role))) return null
  return svc
}

export async function GET() {
  const svc = await requireAdmin()
  if (!svc) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data, error } = await svc
    .from('dd_voicemails')
    .select('*')
    .order('received_at', { ascending: false })
    .limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ voicemails: data || [] })
}

export async function PATCH(req: NextRequest) {
  const svc = await requireAdmin()
  if (!svc) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id, listened, notes } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const updates: Record<string, unknown> = {}
  if (listened === true) updates.listened_at = new Date().toISOString()
  if (listened === false) updates.listened_at = null
  if (typeof notes === 'string') updates.notes = notes
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  }
  const { data, error } = await svc.from('dd_voicemails').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ voicemail: data })
}

export async function DELETE(req: NextRequest) {
  const svc = await requireAdmin()
  if (!svc) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await svc.from('dd_voicemails').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
