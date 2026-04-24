import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()
    const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
    if (!ddUser || ddUser.role !== 'admin' && ddUser.role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: shops, error } = await svc
      .from('dd_shops')
      .select('*, owner:dd_users!owner_id(name, email)')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ shops: shops || [] })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()
    const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
    if (!ddUser || (ddUser.role !== 'admin' && ddUser.role !== 'manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { name, address, city, state, zip, phone, description, delivery_fee, min_order, tax_rate, service_fee_pct, lat, lng } = body

    if (!name?.trim() || !address?.trim() || !city?.trim() || !zip?.trim()) {
      return NextResponse.json({ error: 'Name, address, city, and ZIP are required' }, { status: 400 })
    }

    // Generate slug from name
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    // Check for duplicate slug
    const { data: existing } = await svc.from('dd_shops').select('id').eq('slug', slug).single()
    const finalSlug = existing ? `${slug}-${Date.now().toString(36)}` : slug

    const { data: shop, error } = await svc.from('dd_shops').insert({
      name: name.trim(),
      slug: finalSlug,
      address: address.trim(),
      city: city.trim(),
      state: (state || 'TX').trim(),
      zip: zip.trim(),
      phone: phone?.trim() || null,
      description: description?.trim() || null,
      delivery_fee: delivery_fee ?? 3.99,
      min_order: min_order ?? 10,
      tax_rate: tax_rate ?? 8.25,
      service_fee_pct: service_fee_pct ?? 15,
      lat: lat || null,
      lng: lng || null,
      owner_id: ddUser.id,
      is_active: true,
      is_claimed: false,
      claim_source: 'admin',
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ shop })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()
    const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
    if (!ddUser || ddUser.role !== 'admin' && ddUser.role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { id, ...fields } = body

    // Only allow these fields to be updated
    const allowed: Record<string, any> = {}
    if ('is_active' in fields) allowed.is_active = fields.is_active
    if ('service_fee_pct' in fields) allowed.service_fee_pct = fields.service_fee_pct
    if ('delivery_fee' in fields) allowed.delivery_fee = fields.delivery_fee
    if ('min_order' in fields) allowed.min_order = fields.min_order
    if ('tax_rate' in fields) allowed.tax_rate = fields.tax_rate

    const { data: shop, error } = await svc
      .from('dd_shops')
      .update(allowed)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ shop })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
