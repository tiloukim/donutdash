import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('role').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'admin' && ddUser.role !== 'manager')) return null
  return svc
}

function normalizePhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '')
  if (!digits) return null
  if (digits.startsWith('+')) return digits
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

function validateExtension(ext: string): boolean {
  if (!/^\d{2,4}$/.test(ext)) return false
  // Reserve 0-4 (used by main menu) — extensions must be 2+ digits and not
  // start with a single menu-option digit alone, but multi-digit overlap is fine.
  if (ext.length < 2) return false
  return true
}

export async function GET() {
  const svc = await requireAdmin()
  if (!svc) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data, error } = await svc
    .from('dd_ivr_extensions')
    .select('*')
    .order('extension', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ extensions: data || [] })
}

export async function POST(req: NextRequest) {
  const svc = await requireAdmin()
  if (!svc) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json()

  const extension = String(body.extension || '').trim()
  if (!validateExtension(extension)) {
    return NextResponse.json({ error: 'Extension must be 2-4 digits' }, { status: 400 })
  }
  const name = String(body.name || '').trim()
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  const phone = normalizePhone(String(body.phone_number || ''))
  if (!phone) return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })

  const { data, error } = await svc.from('dd_ivr_extensions').insert({
    extension,
    name,
    phone_number: phone,
    voicemail_only: !!body.voicemail_only,
    active: body.active !== false,
  }).select().single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: `Extension ${extension} is already taken` }, { status: 400 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ extension: data })
}

export async function PATCH(req: NextRequest) {
  const svc = await requireAdmin()
  if (!svc) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json()
  const id = body.id
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) {
    const n = String(body.name).trim()
    if (!n) return NextResponse.json({ error: 'Name cannot be blank' }, { status: 400 })
    updates.name = n
  }
  if (body.phone_number !== undefined) {
    const p = normalizePhone(String(body.phone_number))
    if (!p) return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    updates.phone_number = p
  }
  if (body.extension !== undefined) {
    const e = String(body.extension).trim()
    if (!validateExtension(e)) return NextResponse.json({ error: 'Extension must be 2-4 digits' }, { status: 400 })
    updates.extension = e
  }
  if (body.voicemail_only !== undefined) updates.voicemail_only = !!body.voicemail_only
  if (body.active !== undefined) updates.active = !!body.active
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  updates.updated_at = new Date().toISOString()

  const { data, error } = await svc.from('dd_ivr_extensions').update(updates).eq('id', id).select().single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Extension is already taken' }, { status: 400 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ extension: data })
}

export async function DELETE(req: NextRequest) {
  const svc = await requireAdmin()
  if (!svc) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await svc.from('dd_ivr_extensions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
