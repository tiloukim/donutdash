import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'driver' && ddUser.role !== 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { delivery_id } = await req.json()

  // Atomically assign - only works if driver_id is still null
  const { data, error } = await svc.from('dd_deliveries')
    .update({ driver_id: ddUser.id, status: 'assigned', updated_at: new Date().toISOString() })
    .eq('id', delivery_id)
    .is('driver_id', null)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Delivery already taken by another driver' }, { status: 409 })
  }

  return NextResponse.json(data)
}
