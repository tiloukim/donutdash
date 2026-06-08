import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { verifyPin } from '@/lib/pin-hash'

// POST /api/pos/owner-pin/verify
// Body: { shop_id, pin }
// Returns:
//   200 { ok: true }                       PIN matched
//   401 { error: 'Wrong PIN', attemptsLeft, lockedUntil? }
//   423 { error: 'Locked',     lockedUntil }   too many failures
//
// Caller must be signed in (any role with shop access — the Supabase
// auth is the FIRST factor). PIN is the SECOND factor specifically
// for sensitive in-app surfaces.

const MAX_ATTEMPTS = 5
const LOCK_DURATION_MS = 10 * 60 * 1000

interface PostBody {
  shop_id: string
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
  if (!body.shop_id || !body.pin) {
    return NextResponse.json({ error: 'shop_id + pin required' }, { status: 400 })
  }

  const svc = createServiceClient()
  const { data: shop } = await svc
    .from('dd_shops')
    .select('owner_pin_hash, owner_pin_salt, owner_pin_failed_attempts, owner_pin_locked_until')
    .eq('id', body.shop_id)
    .maybeSingle()
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

  const row = shop as {
    owner_pin_hash: string | null
    owner_pin_salt: string | null
    owner_pin_failed_attempts: number
    owner_pin_locked_until: string | null
  }
  if (!row.owner_pin_hash || !row.owner_pin_salt) {
    return NextResponse.json({ error: 'PIN not set' }, { status: 404 })
  }

  // Locked-out branch — refuse with a clear timestamp so the UI can
  // count down. Cashier has to wait, or the shop owner can DELETE the
  // PIN entirely to unlock.
  if (row.owner_pin_locked_until && new Date(row.owner_pin_locked_until) > new Date()) {
    return NextResponse.json(
      { error: 'Locked — too many wrong attempts', lockedUntil: row.owner_pin_locked_until },
      { status: 423 },
    )
  }

  const ok = verifyPin(body.pin, row.owner_pin_salt, row.owner_pin_hash)
  if (!ok) {
    const newAttempts = row.owner_pin_failed_attempts + 1
    const shouldLock = newAttempts >= MAX_ATTEMPTS
    const lockedUntil = shouldLock ? new Date(Date.now() + LOCK_DURATION_MS).toISOString() : null
    await svc
      .from('dd_shops')
      .update({
        owner_pin_failed_attempts: shouldLock ? 0 : newAttempts,
        owner_pin_locked_until: lockedUntil,
      })
      .eq('id', body.shop_id)

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

  // Success — clear the failure counter so a slow finger doesn't
  // accumulate failures across legitimate sessions.
  if (row.owner_pin_failed_attempts > 0 || row.owner_pin_locked_until) {
    await svc
      .from('dd_shops')
      .update({ owner_pin_failed_attempts: 0, owner_pin_locked_until: null })
      .eq('id', body.shop_id)
  }
  return NextResponse.json({ ok: true })
}
