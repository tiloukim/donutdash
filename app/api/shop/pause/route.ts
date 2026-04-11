import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id').eq('auth_id', user.id).single()
  if (!ddUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: shop } = await svc.from('dd_shops').select('paused, pause_reason, pause_until').eq('owner_id', ddUser.id).single()

  // Auto-unpause if pause_until has passed
  if (shop?.paused && shop?.pause_until && new Date(shop.pause_until) <= new Date()) {
    await svc.from('dd_shops').update({ paused: false, pause_reason: null, pause_until: null }).eq('owner_id', ddUser.id)
    return NextResponse.json({ paused: false, pause_reason: null, pause_until: null })
  }

  return NextResponse.json({
    paused: shop?.paused || false,
    pause_reason: shop?.pause_reason || null,
    pause_until: shop?.pause_until || null,
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id').eq('auth_id', user.id).single()
  if (!ddUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { paused, reason, pause_until } = await request.json()

  const { error } = await svc.from('dd_shops')
    .update({
      paused: !!paused,
      pause_reason: reason || null,
      pause_until: paused ? (pause_until || null) : null,
    })
    .eq('owner_id', ddUser.id)

  if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  return NextResponse.json({ paused: !!paused, pause_until: paused ? pause_until : null })
}
