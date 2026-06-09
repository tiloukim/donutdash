import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { hashPin } from '@/lib/pin-hash'

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

  if (caller.role === 'admin' || caller.role === 'manager') {
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

  // Create the lightweight dd_users row first. auth_id stays null —
  // cashiers don't sign in via Supabase auth; the PIN gate inside the
  // already-authenticated owner session is their identity check.
  const { data: ddUser, error: userErr } = await a.svc
    .from('dd_users')
    .insert({
      name: body.name.trim(),
      role: 'cashier',  // dd_users.role keeps the "this user is a cashier" semantic
    })
    .select('id')
    .single()
  if (userErr || !ddUser) {
    return NextResponse.json({ error: userErr?.message ?? 'User create failed' }, { status: 500 })
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
