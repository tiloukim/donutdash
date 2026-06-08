import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// PATCH  /api/admin/pitch-campaign/:id — update status / notes / email
// DELETE /api/admin/pitch-campaign/:id — hard delete from the list
// Admin / manager only.

async function authorize() {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const svc = createServiceClient()
  const { data: caller } = await svc
    .from('dd_users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()
  if (!caller || (caller.role !== 'admin' && caller.role !== 'manager')) {
    return { error: 'Forbidden', status: 403 as const }
  }
  return { svc, caller }
}

interface PatchBody {
  status?: 'active' | 'paused' | 'replied'
  recipient_email?: string
  recipient_name?: string | null
  recipient_phone?: string | null
  notes?: string | null
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await authorize()
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  const { id } = await params
  let body: PatchBody
  try {
    body = (await req.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  if (body.status && ['active', 'paused', 'replied'].includes(body.status)) patch.status = body.status
  if (body.recipient_email !== undefined) patch.recipient_email = body.recipient_email.trim().toLowerCase()
  if (body.recipient_name !== undefined) patch.recipient_name = body.recipient_name?.trim() || null
  if (body.recipient_phone !== undefined) patch.recipient_phone = body.recipient_phone?.trim() || null
  if (body.notes !== undefined) patch.notes = body.notes?.trim() || null
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { error } = await a.svc
    .from('dd_pitch_campaign_recipients')
    .update(patch)
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await authorize()
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  const { id } = await params
  const { error } = await a.svc
    .from('dd_pitch_campaign_recipients')
    .delete()
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id })
}
