import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Public endpoint — token-gated, NOT login-gated. The whole point of this is so
// employees without DonutDash accounts can update their card photo from a magic
// link the admin sent them.

export async function POST(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')
  const token = req.nextUrl.searchParams.get('t')
  if (!slug || !token) return NextResponse.json({ error: 'Missing slug or token' }, { status: 400 })

  const svc = createServiceClient()

  // Look up the member by both slug AND token to make the link unforgeable —
  // guessing one without the other gets nowhere.
  const { data: member } = await svc
    .from('dd_team_members')
    .select('id, slug, upload_token')
    .ilike('slug', slug)
    .maybeSingle()
  if (!member || !member.upload_token || member.upload_token !== token) {
    return NextResponse.json({ error: 'Invalid or expired upload link' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })
  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.type)) return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })

  const ext = file.name.split('.').pop() || 'jpg'
  const fileName = `team/${member.id}-${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await svc.storage
    .from('images')
    .upload(fileName, buffer, { contentType: file.type, upsert: true })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: urlData } = svc.storage.from('images').getPublicUrl(fileName)

  const { error: updateError } = await svc
    .from('dd_team_members')
    .update({ photo_url: urlData.publicUrl })
    .eq('id', member.id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ success: true, url: urlData.publicUrl })
}
