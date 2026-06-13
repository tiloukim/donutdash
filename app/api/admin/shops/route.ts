import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canAccessAdminPortal } from '@/lib/admin-auth'
import { MIN_COMMISSION_RATE, MAX_COMMISSION_RATE, SHOP_COMMISSION_RATE } from '@/lib/constants'

const MIN_COMMISSION_PCT = MIN_COMMISSION_RATE * 100
const MAX_COMMISSION_PCT = MAX_COMMISSION_RATE * 100
const DEFAULT_COMMISSION_PCT = SHOP_COMMISSION_RATE * 100

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()
    const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
    if (!ddUser || !canAccessAdminPortal(ddUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
    if (!ddUser || (!canAccessAdminPortal(ddUser.role))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { name, address, city, state, zip, phone, description, delivery_fee, min_order, tax_rate, service_fee_pct, commission_pct, lat, lng } = body

    if (!name?.trim() || !address?.trim() || !city?.trim() || !zip?.trim()) {
      return NextResponse.json({ error: 'Name, address, city, and ZIP are required' }, { status: 400 })
    }

    const commissionPct = commission_pct == null ? DEFAULT_COMMISSION_PCT : Number(commission_pct)
    if (!Number.isFinite(commissionPct) || commissionPct < MIN_COMMISSION_PCT || commissionPct > MAX_COMMISSION_PCT) {
      return NextResponse.json({ error: `Commission must be between ${MIN_COMMISSION_PCT}% and ${MAX_COMMISSION_PCT}%` }, { status: 400 })
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
      service_fee_pct: service_fee_pct ?? 10,
      commission_pct: commissionPct,
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
    if (!ddUser || !canAccessAdminPortal(ddUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { id, ...fields } = body

    // Revenue-impacting fields are admin-only — a marketing manager
    // shouldn't be able to flip commission rates or service fees. UI
    // surface for these fields is already admin-gated, this is the
    // matching server enforcement.
    const REVENUE_FIELDS = ['commission_pct', 'service_fee_pct', 'tax_rate', 'delivery_fee', 'min_order', 'cash_discount_pct']
    const callerIsAdmin = ddUser.role === 'admin'
    const touchesRevenue = REVENUE_FIELDS.some(k => k in fields)
    if (touchesRevenue && !callerIsAdmin) {
      return NextResponse.json({ error: 'Only admins can change pricing or commission fields' }, { status: 403 })
    }

    // Only allow these fields to be updated
    const allowed: Record<string, any> = {}
    if ('is_active' in fields) allowed.is_active = fields.is_active
    if ('service_fee_pct' in fields) allowed.service_fee_pct = fields.service_fee_pct
    if ('delivery_fee' in fields) allowed.delivery_fee = fields.delivery_fee
    if ('min_order' in fields) allowed.min_order = fields.min_order
    if ('tax_rate' in fields) allowed.tax_rate = fields.tax_rate
    if ('commission_pct' in fields) {
      const pct = Number(fields.commission_pct)
      if (!Number.isFinite(pct) || pct < MIN_COMMISSION_PCT || pct > MAX_COMMISSION_PCT) {
        return NextResponse.json({ error: `Commission must be between ${MIN_COMMISSION_PCT}% and ${MAX_COMMISSION_PCT}%` }, { status: 400 })
      }
      allowed.commission_pct = pct
    }
    if ('cash_discount_pct' in fields) {
      // 0 disables the dual-charges popup entirely. Capping at 10
      // (well below the SQL check at 25) because higher than 10% is
      // basically always a misconfiguration — typical card processor
      // savings the program is designed to recover is ~2.5–4%.
      const pct = Number(fields.cash_discount_pct)
      if (!Number.isFinite(pct) || pct < 0 || pct > 10) {
        return NextResponse.json({ error: 'Cash discount must be between 0% and 10%' }, { status: 400 })
      }
      allowed.cash_discount_pct = pct
    }
    if ('pricing_mode' in fields) {
      // Three modes match the SQL enum check. 'standard' is the
      // pre-program behavior; 'cash_discount' fires a popup at
      // checkout; 'dual_pricing' shows both prices on every item up
      // front. Anything else is rejected.
      const mode = String(fields.pricing_mode)
      if (!['standard', 'cash_discount', 'dual_pricing'].includes(mode)) {
        return NextResponse.json({ error: 'pricing_mode must be standard, cash_discount, or dual_pricing' }, { status: 400 })
      }
      allowed.pricing_mode = mode
    }

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
