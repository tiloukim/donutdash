import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('role').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'admin' && ddUser.role !== 'manager')) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { svc, ddUser }
}

function normalizeSlug(raw: string): string {
  // URL-safe slug: alphanumerics + hyphens. Preserve case so Tilou's "Tilou" URL keeps working.
  return raw.trim().replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
}

export async function GET() {
  const auth = await requireAdmin()
  if (auth.error) return auth.error
  const { data, error } = await auth.svc.from('dd_team_members').select('*').order('display_order').order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ team: data || [] })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error
  const body = await req.json()
  const { name, title, phone, email, location, slug, photo_url, display_order } = body

  if (!name?.trim() || !title?.trim() || !phone?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'Name, title, phone, and email are required' }, { status: 400 })
  }
  const finalSlug = normalizeSlug(slug || name.split(' ')[0])
  if (!finalSlug) return NextResponse.json({ error: 'Slug cannot be empty' }, { status: 400 })

  const { data, error } = await auth.svc
    .from('dd_team_members')
    .insert({
      slug: finalSlug,
      name: name.trim(),
      title: title.trim(),
      phone: phone.trim(),
      email: email.trim(),
      location: (location || 'Tyler, Texas').trim(),
      photo_url: photo_url || null,
      display_order: typeof display_order === 'number' ? display_order : 0,
      is_active: true,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === '23505' ? 400 : 500 })
  return NextResponse.json({ member: data })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error
  const body = await req.json()
  const { id, ...fields } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Only update fields that were explicitly sent. Don't nullify by omission.
  const allowed: Record<string, unknown> = {}
  for (const key of ['name', 'title', 'phone', 'email', 'location', 'photo_url', 'is_active', 'display_order'] as const) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) allowed[key] = fields[key]
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'slug')) {
    const s = normalizeSlug(String(fields.slug || ''))
    if (!s) return NextResponse.json({ error: 'Slug cannot be empty' }, { status: 400 })
    allowed.slug = s
  }
  if (Object.keys(allowed).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

  const { data, error } = await auth.svc.from('dd_team_members').update(allowed).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === '23505' ? 400 : 500 })
  return NextResponse.json({ member: data })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await auth.svc.from('dd_team_members').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
