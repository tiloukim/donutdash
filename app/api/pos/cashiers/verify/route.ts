import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { verifyPin } from '@/lib/pin-hash'

// POST /api/pos/cashiers/verify
// Body: { staff_id, pin }
//
// Used by the cashier-picker on the POS: tap a name → enter PIN →
// this route confirms it. On success returns the staff metadata so
// the client can drop the active cashier into CashierContext +
// AsyncStorage.
//
// 5 wrong tries → 10 min cooldown (same rate-limit shape as the
// owner PIN). Shop_owner can reset a stuck cashier via PATCH with a
// fresh PIN.

const MAX_ATTEMPTS = 5
const LOCK_DURATION_MS = 10 * 60 * 1000

interface PostBody {
  staff_id: string
  pin: string
}

export async function POST(req: NextRequest) {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: PostBody
  try {
    body = (await req.json()) as PostBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.staff_id || !body.pin) {
    return NextResponse.json({ error: 'staff_id + pin required' }, { status: 400 })
  }

  const svc = createServiceClient()

  // Resolve caller. The cashier-verify flow runs inside an already-
  // authenticated shop device session; the calling user must own (or
  // operate platform-wide) the shop the staff row belongs to. Without
  // this, any signed-in user could enumerate cashiers and probe PINs
  // — eventually locking every cashier in the system (DoS).
  const { data: caller } = await svc
    .from('dd_users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: staffWithShop } = await svc
    .from('dd_shop_staff')
    .select(`
      id, shop_id, role, status, pin_hash, pin_salt, pin_failed_attempts, pin_locked_until,
      user:dd_users!user_id(id, name)
    `)
    .eq('id', body.staff_id)
    .maybeSingle()
  if (!staffWithShop) return NextResponse.json({ error: 'Cashier not found' }, { status: 404 })

  const isAdminOrOps = caller.role === 'admin'
    || caller.role === 'general_manager'
    || caller.role === 'field_manager'
  if (!isAdminOrOps) {
    const { data: shop } = await svc
      .from('dd_shops')
      .select('owner_id')
      .eq('id', staffWithShop.shop_id)
      .maybeSingle()
    const isOwner = shop?.owner_id === caller.id
    const { data: callerStaff } = await svc
      .from('dd_shop_staff')
      .select('id')
      .eq('shop_id', staffWithShop.shop_id)
      .eq('user_id', caller.id)
      .eq('status', 'active')
      .maybeSingle()
    if (!isOwner && !callerStaff) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const staff = staffWithShop

  const row = staff as unknown as {
    id: string
    role: string
    status: string
    pin_hash: string
    pin_salt: string
    pin_failed_attempts: number
    pin_locked_until: string | null
    user: { id: string; name: string | null } | null
  }
  if (row.status !== 'active') {
    return NextResponse.json({ error: 'Cashier is inactive' }, { status: 403 })
  }
  if (row.pin_locked_until && new Date(row.pin_locked_until) > new Date()) {
    return NextResponse.json(
      { error: 'Locked — too many wrong attempts', lockedUntil: row.pin_locked_until },
      { status: 423 },
    )
  }

  const ok = verifyPin(body.pin, row.pin_salt, row.pin_hash)
  if (!ok) {
    const newAttempts = row.pin_failed_attempts + 1
    const shouldLock = newAttempts >= MAX_ATTEMPTS
    const lockedUntil = shouldLock ? new Date(Date.now() + LOCK_DURATION_MS).toISOString() : null
    await svc
      .from('dd_shop_staff')
      .update({
        pin_failed_attempts: shouldLock ? 0 : newAttempts,
        pin_locked_until: lockedUntil,
      })
      .eq('id', row.id)
    if (shouldLock) {
      return NextResponse.json(
        { error: 'Locked — too many wrong attempts', lockedUntil },
        { status: 423 },
      )
    }
    return NextResponse.json(
      { error: 'Wrong PIN', attemptsLeft: MAX_ATTEMPTS - newAttempts },
      { status: 401 },
    )
  }

  // Success — clear failure state.
  if (row.pin_failed_attempts > 0 || row.pin_locked_until) {
    await svc
      .from('dd_shop_staff')
      .update({ pin_failed_attempts: 0, pin_locked_until: null })
      .eq('id', row.id)
  }
  return NextResponse.json({
    ok: true,
    staff_id: row.id,
    user_id: row.user?.id,
    name: row.user?.name,
    role: row.role,
  })
}
