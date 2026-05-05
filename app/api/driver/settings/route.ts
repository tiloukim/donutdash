import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'driver' && ddUser.role !== 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json({
    name: ddUser.name,
    phone: ddUser.phone,
    email: ddUser.email,
    avatar_url: ddUser.avatar_url || '',
  })
}

export async function PUT(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'driver' && ddUser.role !== 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()

  // Only update fields that were explicitly sent. Sending undefined or missing
  // fields used to nullify them on the row — broke avatar-only saves where the
  // client didn't echo back name/phone.
  // (No updated_at — dd_users doesn't have that column, and writing it was the
  // root cause of "doesn't save"; supabase-js raises a schema-cache error.)
  const updates: Record<string, unknown> = {}
  if (Object.prototype.hasOwnProperty.call(body, 'name') && typeof body.name === 'string') updates.name = body.name
  if (Object.prototype.hasOwnProperty.call(body, 'phone') && typeof body.phone === 'string') updates.phone = body.phone
  if (Object.prototype.hasOwnProperty.call(body, 'avatar_url')) updates.avatar_url = body.avatar_url || null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ name: ddUser.name, phone: ddUser.phone, email: ddUser.email, avatar_url: ddUser.avatar_url || '' })
  }

  const { data, error } = await svc.from('dd_users')
    .update(updates)
    .eq('id', ddUser.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    name: data.name,
    phone: data.phone,
    email: data.email,
    avatar_url: data.avatar_url || '',
  })
}
