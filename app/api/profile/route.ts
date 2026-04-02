import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: profile } = await svc.from('dd_users').select('id, name, email, phone, role').eq('auth_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Get saved addresses
  const { data: addresses } = await svc.from('dd_addresses').select('*').eq('user_id', profile.id).order('is_default', { ascending: false })

  return NextResponse.json({ profile, addresses: addresses || [] })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id').eq('auth_id', user.id).single()
  if (!ddUser) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const body = await req.json()
  const { action } = body

  if (action === 'update_profile') {
    const { name, phone } = body
    const { error } = await svc.from('dd_users').update({ name, phone }).eq('id', ddUser.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (action === 'add_address') {
    const { label, address, city, state, zip } = body
    // If setting as default, unset other defaults first
    if (body.is_default) {
      await svc.from('dd_addresses').update({ is_default: false }).eq('user_id', ddUser.id)
    }
    const { data, error } = await svc.from('dd_addresses').insert({
      user_id: ddUser.id,
      label: label || 'Home',
      address,
      city,
      state: state || 'TX',
      zip,
      is_default: body.is_default || false,
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ address: data })
  }

  if (action === 'update_address') {
    const { addressId, label, address, city, state, zip, is_default } = body
    if (is_default) {
      await svc.from('dd_addresses').update({ is_default: false }).eq('user_id', ddUser.id)
    }
    const { error } = await svc.from('dd_addresses').update({ label, address, city, state, zip, is_default }).eq('id', addressId).eq('user_id', ddUser.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (action === 'delete_address') {
    const { addressId } = body
    const { error } = await svc.from('dd_addresses').delete().eq('id', addressId).eq('user_id', ddUser.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
