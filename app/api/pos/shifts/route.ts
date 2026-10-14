import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { assertPosAccess } from '@/lib/pos-shop-auth'
import { resolveClientTime, normalizeClientKey } from '@/lib/pos-client-time'

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
  /** Idempotency key from the register, so a replayed offline clock-in does
   *  not start a second shift for one physical one. */
  client_key?: string | null
  /** When the person actually clocked in. On replay now() would be the
   *  moment the internet returned, which mis-states payroll by the length of
   *  the outage. */
  clock_in?: string | null
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

  // POS entitlement gate — no clocking in for a deactivated/POS-disabled shop.
  const gate = await assertPosAccess(a.svc, a.caller.id, body.shop_id)
  if (gate) return NextResponse.json({ error: gate.error }, { status: gate.status })

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

  const clientKey = normalizeClientKey(body.client_key)

  // Replay first: if this exact clock-in already landed, return it. Checked
  // before the open-shift cleanup below, because that cleanup would
  // otherwise clock the person OUT of the very shift this replay created.
  if (clientKey) {
    const { data: prior } = await a.svc
      .from('dd_shifts')
      .select('id, clock_in')
      .eq('shop_id', body.shop_id)
      .eq('client_key', clientKey)
      .maybeSingle()
    if (prior) return NextResponse.json({ shift: prior, replayed: true })
  }

  const clockIn = resolveClientTime(body.clock_in)

  // Close any open shift for this user before starting a fresh one.
  //
  // Closed AT THE NEW SHIFT'S CLOCK-IN, not at now(). For a replayed offline
  // clock-in those differ by the length of the outage, and using now() would
  // both overpay the previous shift and overlap two shifts for one person.
  await a.svc
    .from('dd_shifts')
    .update({ clock_out: clockIn.iso })
    .eq('shop_id', body.shop_id)
    .eq('user_id', body.user_id)
    .is('clock_out', null)
    // Never close a shift that started after the one being opened — out-of-
    // order replay would otherwise reach forward and truncate a later shift.
    .lte('clock_in', clockIn.iso)

  const { data, error } = await a.svc
    .from('dd_shifts')
    .insert({
      shop_id: body.shop_id,
      user_id: body.user_id,
      notes: body.notes ?? null,
      client_key: clientKey,
      clock_in: clockIn.iso,
    })
    .select('id, clock_in')
    .single()
  if (error) {
    if (clientKey && error.code === '23505') {
      const { data: raced } = await a.svc
        .from('dd_shifts')
        .select('id, clock_in')
        .eq('shop_id', body.shop_id)
        .eq('client_key', clientKey)
        .maybeSingle()
      if (raced) return NextResponse.json({ shift: raced, replayed: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({
    shift: data,
    clockInRejected: clockIn.accepted ? undefined : (clockIn.reason ?? 'defaulted'),
  })
}

// PATCH /api/pos/shifts — clock out. Body: { shift_id, notes? }
interface PatchBody {
  shift_id: string
  notes?: string | null
  /** When the person actually clocked out, for a replayed offline clock-out. */
  clock_out?: string | null
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
  const { data: shiftRow } = await a.svc.from('dd_shifts')
    .select('shop_id, clock_out').eq('id', body.shift_id).maybeSingle()
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

  // Already clocked out: a replay must not move the time. Payroll is paid
  // from these two timestamps, so re-stamping clock_out on every retry would
  // silently extend a shift by however long the outage lasted.
  const existingOut = (shiftRow as { clock_out: string | null }).clock_out
  if (existingOut && body.notes === undefined) {
    return NextResponse.json({ ok: true, replayed: true, clock_out: existingOut })
  }

  const clockOut = resolveClientTime(body.clock_out)
  const patch: Record<string, unknown> = {}
  // Don't overwrite an existing clock_out when this call is only about notes.
  if (!existingOut) patch.clock_out = clockOut.iso
  if (body.notes !== undefined) patch.notes = body.notes

  const { error } = await a.svc
    .from('dd_shifts')
    .update(patch)
    .eq('id', body.shift_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    ok: true,
    clockOutRejected: existingOut || clockOut.accepted ? undefined : (clockOut.reason ?? 'defaulted'),
  })
}
