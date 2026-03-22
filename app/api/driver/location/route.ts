import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST - update driver location
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'driver' && ddUser.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { lat, lng, heading, speed } = await req.json()

  if (lat === undefined || lng === undefined) {
    return NextResponse.json({ error: 'Missing lat/lng' }, { status: 400 })
  }

  const { data, error } = await svc
    .from('dd_driver_locations')
    .upsert({
      driver_id: ddUser.id,
      lat,
      lng,
      heading: heading || null,
      speed: speed || null,
      is_online: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'driver_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
