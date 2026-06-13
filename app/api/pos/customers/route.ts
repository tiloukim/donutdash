import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/pos/customers — walk-in customer capture for the POS.
//
// The POS app's local Supabase client (auth = signed-in cashier) can
// SELECT from dd_users but cannot INSERT — RLS blocks "this auth user
// is creating a record for someone else" since dd_users rows usually
// represent the row's own auth user, not a customer the cashier rang
// up. This endpoint sidesteps that via the service-role client after
// confirming the caller is a shop_owner / manager / admin authorized
// to make walk-in customer rows.
//
// Dedupe matches the previous client logic: email first, then phone.
// Returns the existing row if either matches so a repeat walk-in
// customer doesn't stack new records.

interface PostBody {
  name: string
  email?: string | null
  phone?: string | null
}

export async function POST(req: NextRequest) {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: caller } = await svc
    .from('dd_users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!caller) return NextResponse.json({ error: 'No DonutDash profile' }, { status: 403 })

  // Cashier needs a real role to ring up walk-ins. Customers / drivers
  // shouldn't be touching this endpoint.
  if (!['shop_owner', 'admin', 'general_manager', 'field_manager'].includes(caller.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: PostBody
  try {
    body = (await req.json()) as PostBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = (body.name ?? '').trim()
  const email = body.email?.trim().toLowerCase() || null
  const phone = body.phone?.trim() || null
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  // Best-effort dedupe — same order as the old client logic to avoid
  // surprising the cashier with a different row id. Use eq() not ilike()
  // since email is already lowercased above; ilike would treat unescaped
  // % from a malicious client as a wildcard and leak PII from foreign
  // customer rows.
  if (email) {
    const { data: existing } = await svc
      .from('dd_users')
      .select('id, name, email, phone')
      .eq('role', 'customer')
      .eq('email', email)
      .limit(1)
    if (existing && existing.length > 0) {
      return NextResponse.json({ customer: existing[0] })
    }
  }
  if (phone) {
    const { data: existing } = await svc
      .from('dd_users')
      .select('id, name, email, phone')
      .eq('role', 'customer')
      .eq('phone', phone)
      .limit(1)
    if (existing && existing.length > 0) {
      return NextResponse.json({ customer: existing[0] })
    }
  }

  const { data, error } = await svc
    .from('dd_users')
    .insert({ name, email, phone, role: 'customer' })
    .select('id, name, email, phone')
    .single()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ customer: data })
}
