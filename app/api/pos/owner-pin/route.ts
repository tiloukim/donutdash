import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { hashPin } from '@/lib/pin-hash'

// GET    /api/pos/owner-pin?shop_id=  → status
// POST   /api/pos/owner-pin            → set the PIN
// DELETE /api/pos/owner-pin?shop_id=  → reset (requires shop_owner / admin)
//
// Verify endpoint is /api/pos/owner-pin/verify (separate file so it's
// rate-limited and shape-stable independent of the management routes).

async function authorizeForShop(shopId: string) {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const svc = createServiceClient()
  const { data: caller } = await svc
    .from('dd_users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()
  if (!caller) return { error: 'No DonutDash profile', status: 403 as const }

  if (caller.role !== 'admin' && caller.role !== 'general_manager' && caller.role !== 'field_manager') {
    const { data: shop } = await svc
      .from('dd_shops')
      .select('id')
      .eq('id', shopId)
      .eq('owner_id', caller.id)
      .maybeSingle()
    if (!shop) return { error: 'You do not own this shop', status: 403 as const }
  }
  return { svc, caller }
}

// Status — does the shop have a PIN configured? Used by the POS lock
// screen to decide between "Set up Owner PIN" and "Enter Owner PIN".
// Also surfaces a current lock state (after 5 wrong attempts) so the
// UI can show a friendly countdown.
export async function GET(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get('shop_id')
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  // Only staff/owner of THIS shop can query its PIN state.
  const a = await authorizeForShop(shopId)
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  const { data: shop } = await a.svc
    .from('dd_shops')
    .select('owner_pin_hash, owner_pin_locked_until')
    .eq('id', shopId)
    .maybeSingle()
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

  const lockedUntil = (shop as { owner_pin_locked_until?: string | null }).owner_pin_locked_until
  return NextResponse.json({
    hasPin: !!(shop as { owner_pin_hash?: string | null }).owner_pin_hash,
    lockedUntil: lockedUntil && new Date(lockedUntil) > new Date() ? lockedUntil : null,
  })
}

interface PostBody {
  shop_id: string
  pin: string
}

export async function POST(req: NextRequest) {
  let body: PostBody
  try {
    body = (await req.json()) as PostBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.shop_id || !body.pin) {
    return NextResponse.json({ error: 'shop_id + pin required' }, { status: 400 })
  }
  // 4-6 digits; anything else gets rejected so the UI's keypad
  // constraints are also enforced server-side.
  if (!/^\d{4,6}$/.test(body.pin)) {
    return NextResponse.json({ error: 'PIN must be 4–6 digits' }, { status: 400 })
  }

  const a = await authorizeForShop(body.shop_id)
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  const { hash, salt } = hashPin(body.pin)
  const { error } = await a.svc
    .from('dd_shops')
    .update({
      owner_pin_hash: hash,
      owner_pin_salt: salt,
      owner_pin_failed_attempts: 0,
      owner_pin_locked_until: null,
    })
    .eq('id', body.shop_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — admin or shop_owner of this shop can wipe the PIN. Cashier
// who forgot it can't reset themselves; they need the owner. This is
// intentional — otherwise the gate is meaningless.
export async function DELETE(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get('shop_id')
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const a = await authorizeForShop(shopId)
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  const { error } = await a.svc
    .from('dd_shops')
    .update({
      owner_pin_hash: null,
      owner_pin_salt: null,
      owner_pin_failed_attempts: 0,
      owner_pin_locked_until: null,
    })
    .eq('id', shopId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
