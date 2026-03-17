import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET - check if driver is currently online
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'driver' && ddUser.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: loc } = await svc
    .from('dd_driver_locations')
    .select('is_online')
    .eq('driver_id', ddUser.id)
    .maybeSingle()

  return NextResponse.json({ online: loc?.is_online || false })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'driver' && ddUser.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { online } = await req.json()

  // Check if driver already has a location record
  const { data: existing } = await svc
    .from('dd_driver_locations')
    .select('id')
    .eq('driver_id', ddUser.id)
    .maybeSingle()

  let error
  if (existing) {
    // Only update online status, don't overwrite GPS coordinates
    ;({ error } = await svc
      .from('dd_driver_locations')
      .update({
        is_online: !!online,
        updated_at: new Date().toISOString(),
      })
      .eq('driver_id', ddUser.id))
  } else {
    // First time — create record with 0,0 (GPS will update via /api/driver/location)
    ;({ error } = await svc
      .from('dd_driver_locations')
      .insert({
        driver_id: ddUser.id,
        lat: 0,
        lng: 0,
        is_online: !!online,
        updated_at: new Date().toISOString(),
      }))
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ online: !!online })
}
