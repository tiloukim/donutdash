import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const maxSize = 5 * 1024 * 1024 // 5MB max for voice messages
  if (file.size > maxSize) return NextResponse.json({ error: 'Voice message too large (max 5MB)' }, { status: 400 })

  const allowed = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav']
  if (!allowed.some(t => file.type.startsWith(t.split('/')[0]) && file.type.includes(t.split('/')[1]))) {
    // Be lenient — accept any audio type
    if (!file.type.startsWith('audio/')) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }
  }

  const ext = file.type.includes('mp4') ? 'mp4' : file.type.includes('ogg') ? 'ogg' : 'webm'
  const fileName = `voice/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const svc = createServiceClient()

  const { error: uploadError } = await svc.storage
    .from('images')
    .upload(fileName, buffer, { contentType: file.type, upsert: false })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: urlData } = svc.storage.from('images').getPublicUrl(fileName)
  return NextResponse.json({ url: urlData.publicUrl })
}
