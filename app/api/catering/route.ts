import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const svc = createServiceClient()
    const { data: ddUser } = await svc
      .from('dd_users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single()

    if (!ddUser) {
      return NextResponse.json({ requests: [] })
    }

    const { data, error } = await svc
      .from('dd_catering_requests')
      .select('*, shop:dd_shops(id, name, slug, image_url)')
      .eq('customer_id', ddUser.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ requests: data || [] })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const svc = createServiceClient()
    const { data: ddUser } = await svc
      .from('dd_users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single()

    if (!ddUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { shop_id, event_date, event_time, guest_count, items_description, delivery_address, budget, phone, email } = body

    if (!shop_id || !event_date || !items_description) {
      return NextResponse.json({ error: 'Shop, event date, and items description are required' }, { status: 400 })
    }

    const { data, error } = await svc
      .from('dd_catering_requests')
      .insert({
        customer_id: ddUser.id,
        shop_id,
        event_date,
        event_time: event_time || null,
        guest_count: guest_count ? Number(guest_count) : null,
        items_description,
        delivery_address: delivery_address || null,
        budget: budget || null,
        phone: phone || null,
        email: email || null,
      })
      .select('*, shop:dd_shops(id, name, slug, image_url)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ request: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
