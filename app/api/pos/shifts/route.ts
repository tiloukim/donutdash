import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POS shift management — clock in / clock out endpoints used by the
// register's shift bar. POS client can't write to dd_shifts directly
// (RLS blocks the cashier auth user from inserting rows about
// themselves). Service-role + role check here sidesteps that.

async function authorize() {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const svc = createServiceClient()
  const { data: caller } = await svc
    .from('dd_users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!caller) return { error: 'No DonutDash profile', status: 403 as const }
  if (!['shop_owner', 'admin', 'general_manager', 'field_manager'].includes(caller.role)) {
    return { error: 'Forbidden', status: 403 as const }
  }
  return { svc, caller }
}

// POST /api/pos/shifts — clock in. Closes any open shift first
// (defensive: a phone died mid-shift shouldn't block a fresh
// clock-in). Returns the new shift id.
interface PostBody {
  shop_id: string
  user_id: string
  notes?: string | null
}

export async function POST(req: NextRequest) {
  const a = await authorize()
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  let body: PostBody
  try {
    body = (await req.json()) as PostBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.shop_id || !body.user_id) {
    return NextResponse.json({ error: 'shop_id + user_id required' }, { status: 400 })
  }

  // Cross-shop attribution guard: caller must be the shop owner or an
  // admin/ops role for THIS shop, AND user_id must be a registered
  // staff member of THIS shop. Without this, a shop_owner of Shop A
  // could clock in any user_id at Shop B (or attribute a shift to a
  // random dd_users.id), corrupting payroll.
  if (a.caller.role === 'shop_owner') {
    const { data: ownedShop } = await a.svc
      .from('dd_shops')
      .select('id')
      .eq('id', body.shop_id)
      .eq('owner_id', a.caller.id)
      .maybeSingle()
    if (!ownedShop) {
      return NextResponse.json({ error: 'You do not own this shop' }, { status: 403 })
    }
  }
  // Verify user_id is staff at this shop. Shop owner themselves is also
  // allowed (they may run the register without a dd_shop_staff row).
  if (body.user_id !== a.caller.id) {
    const { data: staffRow } = await a.svc
      .from('dd_shop_staff')
      .select('id')
      .eq('shop_id', body.shop_id)
      .eq('user_id', body.user_id)
      .eq('status', 'active')
      .maybeSingle()
    if (!staffRow) {
      return NextResponse.json({ error: 'user_id is not active staff at this shop' }, { status: 400 })
    }
  }

  // Close any open shift for this user before starting a fresh one.
  await a.svc
    .from('dd_shifts')
    .update({ clock_out: new Date().toISOString() })
    .eq('shop_id', body.shop_id)
    .eq('user_id', body.user_id)
    .is('clock_out', null)

  const { data, error } = await a.svc
    .from('dd_shifts')
    .insert({
      shop_id: body.shop_id,
      user_id: body.user_id,
      notes: body.notes ?? null,
    })
    .select('id, clock_in')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ shift: data })
}

// PATCH /api/pos/shifts — clock out. Body: { shift_id, notes? }
interface PatchBody {
  shift_id: string
  notes?: string | null
}

export async function PATCH(req: NextRequest) {
  const a = await authorize()
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  let body: PatchBody
  try {
    body = (await req.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.shift_id) {
    return NextResponse.json({ error: 'shift_id required' }, { status: 400 })
  }

  // Cross-shop guard: a shop_owner may only edit shifts at their own shop.
  const { data: shiftRow } = await a.svc.from('dd_shifts').select('shop_id').eq('id', body.shift_id).maybeSingle()
  if (!shiftRow) return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
  if (a.caller.role === 'shop_owner') {
    const { data: ownedShop } = await a.svc
      .from('dd_shops')
      .select('id')
      .eq('id', (shiftRow as { shop_id: string }).shop_id)
      .eq('owner_id', a.caller.id)
      .maybeSingle()
    if (!ownedShop) return NextResponse.json({ error: 'You do not own this shop' }, { status: 403 })
  }

  const patch: Record<string, unknown> = { clock_out: new Date().toISOString() }
  if (body.notes !== undefined) patch.notes = body.notes

  const { error } = await a.svc
    .from('dd_shifts')
    .update(patch)
    .eq('id', body.shift_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
