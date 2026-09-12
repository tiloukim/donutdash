import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { hashPin } from '@/lib/pin-hash'
import { assertPosAccess } from '@/lib/pos-shop-auth'
import { randomBytes } from 'crypto'

// GET  /api/pos/cashiers?shop_id=<uuid>  → roster for the picker
// POST /api/pos/cashiers                  → create a new cashier
//
// Cashiers don't have their own Supabase auth — the dd_users row is
// created here with auth_id=null, role='cashier', and a dd_shop_staff
// row carries the PIN + role. The POS picker reads from dd_shop_staff
// to figure out "who can clock in on this Elo today."

async function authorizeShop(shopId: string, mustBeOwnerOrManager: boolean) {
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

  // Admin / general / field managers can manage any shop's cashier roster.
  // Marketing manager is excluded — POS staff is operational, not marketing.
  if (
    caller.role === 'admin' ||
    caller.role === 'general_manager' ||
    caller.role === 'field_manager'
  ) {
    return { svc, caller }
  }
  // Shop owner only for their own shop
  const { data: shop } = await svc
    .from('dd_shops')
    .select('id, owner_id')
    .eq('id', shopId)
    .maybeSingle()
  if (!shop || shop.owner_id !== caller.id) {
    return { error: 'You do not own this shop', status: 403 as const }
  }
  if (mustBeOwnerOrManager && caller.role !== 'shop_owner') {
    return { error: 'Forbidden', status: 403 as const }
  }
  return { svc, caller }
}

// GET — list active cashiers at this shop. Returns ONLY id + name +
// role + status — never pin_hash. Used by the picker, the staff
// management UI, and reports.
export async function GET(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get('shop_id')
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const a = await authorizeShop(shopId, false)
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })
  const gate = await assertPosAccess(a.svc, a.caller.id, shopId)
  if (gate) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const { data, error } = await a.svc
    .from('dd_shop_staff')
    .select(`
      id, role, status, hourly_rate, created_at,
      user:dd_users!user_id(id, name)
    `)
    .eq('shop_id', shopId)
    .order('status', { ascending: true })  // active first
    .order('role', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type Row = {
    id: string
    role: string
    status: string
    hourly_rate: number | null
    created_at: string
    user: { id: string; name: string | null } | null
  }
  const rows = ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    user_id: r.user?.id ?? null,
    name: r.user?.name ?? null,
    role: r.role,
    status: r.status,
    hourly_rate: r.hourly_rate,
    created_at: r.created_at,
  }))
  return NextResponse.json({ cashiers: rows })
}

interface PostBody {
  shop_id: string
  name: string
  pin: string
  role?: 'cashier' | 'manager'  // owner-role assignment goes through a different path
  hourly_rate?: number | null
}

export async function POST(req: NextRequest) {
  let body: PostBody
  try {
    body = (await req.json()) as PostBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.shop_id || !body.name?.trim() || !body.pin) {
    return NextResponse.json({ error: 'shop_id, name, pin required' }, { status: 400 })
  }
  if (!/^\d{4,6}$/.test(body.pin)) {
    return NextResponse.json({ error: 'PIN must be 4–6 digits' }, { status: 400 })
  }
  const role = body.role === 'manager' ? 'manager' : 'cashier'

  const a = await authorizeShop(body.shop_id, false)
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })
  const gate = await assertPosAccess(a.svc, a.caller.id, body.shop_id)
  if (gate) return NextResponse.json({ error: gate.error }, { status: gate.status })

  // Create the lightweight dd_users row first. auth_id stays null —
  // cashiers don't sign in via Supabase auth; the PIN gate inside the
  // already-authenticated owner session is their identity check.
  // Email + phone get unique placeholders because some shops have
  // NOT NULL on those columns inherited from the old marketplace
  // schema (back when every user came in via Supabase signup). The
  // placeholder shape `cashier-<8hex>@cashier.pos.local` is obviously
  // synthetic — no real mail server will route to .pos.local, and
  // the prefix makes it grep-able in reports.
  const slug = randomBytes(4).toString('hex')
  const placeholderEmail = `cashier-${slug}@cashier.pos.local`
  // Phone gets a synthetic placeholder too — same legacy NOT NULL risk.
  // Format: '+0' + 9-digit slug-derived suffix. Always 11 chars to
  // satisfy phone-like format checks if any exist, and the leading
  // '+0' makes it obviously synthetic (no real country code starts
  // with 0). Padded so two cashiers can't collide.
  const phoneDigits = Array.from(slug)
    .map((c) => parseInt(c, 16) % 10)
    .join('')
    .padEnd(9, '0')
  const placeholderPhone = `+0${phoneDigits}`
  const { data: ddUser, error: userErr } = await a.svc
    .from('dd_users')
    .insert({
      name: body.name.trim(),
      email: placeholderEmail,
      phone: placeholderPhone,
      role: 'cashier',  // dd_users.role keeps the "this user is a cashier" semantic
    })
    .select('id')
    .single()
  if (userErr || !ddUser) {
    // Surface the raw message (including any NOT NULL column name)
    // so the cashier-create error tells us exactly which legacy
    // constraint is blocking, in one round-trip.
    console.error('[pos/cashiers] dd_users insert failed:', userErr)
    return NextResponse.json(
      { error: userErr?.message ?? 'User create failed', code: userErr?.code, details: userErr?.details },
      { status: 500 },
    )
  }

  const { hash, salt } = hashPin(body.pin)
  const { data: staff, error: staffErr } = await a.svc
    .from('dd_shop_staff')
    .insert({
      shop_id: body.shop_id,
      user_id: ddUser.id,
      role,
      pin_hash: hash,
      pin_salt: salt,
      hourly_rate: body.hourly_rate ?? null,
      created_by: a.caller.id,
    })
    .select('id')
    .single()
  if (staffErr) {
    // Roll back the user row so a half-created cashier doesn't linger.
    await a.svc.from('dd_users').delete().eq('id', ddUser.id)
    return NextResponse.json({ error: staffErr.message }, { status: 500 })
  }

  return NextResponse.json({ id: staff.id, user_id: ddUser.id, name: body.name.trim(), role })
}
