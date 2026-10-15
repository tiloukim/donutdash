import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { assertPosAccess } from '@/lib/pos-shop-auth'
import { resolveClientTime, normalizeClientKey } from '@/lib/pos-client-time'

// POS drawer session management — open + close cash drawer banking
// sessions. Same RLS-bypass pattern as /api/pos/shifts.

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

// GET /api/pos/drawer-sessions?shop_id=…&history=1
//
// Reads moved here from a direct Supabase query on the device.
//
// The WRITES always went through this route (service role, RLS bypassed) but
// the register READ dd_drawer_sessions straight from the client under the
// cashier's own JWT. If RLS does not grant that read the query returns no
// rows and no error, so the screen reports "Closed — tap to open" for a
// drawer that is open — and then lets a second one be opened. The table
// holding exactly one row across its whole history is consistent with the
// read never having worked for anyone.
//
// Same auth and the same cross-shop guard as the mutations below, so this is
// not a wider door — it is the same door the writes already use.
export async function GET(req: NextRequest) {
  const a = await authorize()
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  const shopId = req.nextUrl.searchParams.get('shop_id') ?? ''
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  if (a.caller.role === 'shop_owner') {
    const { data: ownedShop } = await a.svc
      .from('dd_shops').select('id').eq('id', shopId).eq('owner_id', a.caller.id).maybeSingle()
    if (!ownedShop) return NextResponse.json({ error: 'You do not own this shop' }, { status: 403 })
  }

  const wantHistory = req.nextUrl.searchParams.get('history') === '1'
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 20) || 20, 100)

  let qb = a.svc
    .from('dd_drawer_sessions')
    .select('id, shop_id, opened_by, opened_at, opening_count, closed_at, closing_count, expected_cash, over_short, notes')
    .eq('shop_id', shopId)
    .order('opened_at', { ascending: false })
  qb = wantHistory ? qb.not('closed_at', 'is', null).limit(limit) : qb.is('closed_at', null).limit(1)

  const { data, error } = await qb
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Opener names resolved separately rather than as an embedded join. The
  // embed depends on the foreign-key NAME, and a renamed constraint turns a
  // working screen into a 500 — a plain lookup has no such dependency.
  const rows = data ?? []
  const ids = [...new Set(rows.map((r) => r.opened_by).filter(Boolean))]
  const names = new Map<string, string | null>()
  if (ids.length) {
    const { data: users } = await a.svc.from('dd_users').select('id, name').in('id', ids)
    for (const u of users ?? []) names.set(u.id, u.name)
  }

  return NextResponse.json({
    sessions: rows.map((r) => ({ ...r, opened_by_name: names.get(r.opened_by) ?? null })),
  })
}

// POST /api/pos/drawer-sessions — open a session with the starting count.
interface PostBody {
  shop_id: string
  user_id: string
  opening_count: number
  /** Idempotency key minted on the register. A replayed offline open must
   *  return the row it already created, not open a second drawer. */
  client_key?: string | null
  /** When the drawer ACTUALLY opened. On replay, now() would be the moment
   *  the internet returned, and expected_cash is computed from sales since
   *  opened_at — so a replayed now() would exclude the entire outage's sales
   *  and report the day as a huge overage. */
  opened_at?: string | null
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
  if (!body.shop_id || !body.user_id || body.opening_count == null) {
    return NextResponse.json({ error: 'shop_id, user_id, opening_count required' }, { status: 400 })
  }
  if (!Number.isFinite(body.opening_count) || body.opening_count < 0) {
    return NextResponse.json({ error: 'opening_count must be a non-negative number' }, { status: 400 })
  }

  // POS entitlement gate — no opening a drawer for a deactivated/POS-disabled
  // shop. (Closing an already-open drawer stays allowed for end-of-day.)
  const gate = await assertPosAccess(a.svc, a.caller.id, body.shop_id)
  if (gate) return NextResponse.json({ error: gate.error }, { status: gate.status })

  // Same cross-shop attribution guard as /api/pos/shifts. Without this
  // an authorized shop_owner could open a drawer at the wrong shop, or
  // attribute it to a random user_id.
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

  // Replay check comes FIRST. A flush that already succeeded and then lost
  // the response must get the same row back rather than a 409 about a drawer
  // being open — which is what the guard below would otherwise say about this
  // request's own earlier attempt.
  if (clientKey) {
    const { data: prior } = await a.svc
      .from('dd_drawer_sessions')
      .select('id, opened_at')
      .eq('shop_id', body.shop_id)
      .eq('client_key', clientKey)
      .maybeSingle()
    if (prior) return NextResponse.json({ session: prior, replayed: true })
  }

  // Refuse to open a fresh session if one is already open at this shop
  // — otherwise the cash-sales window calc on close becomes meaningless
  // (it would sum sales attributed to the older session too).
  const { data: openSession } = await a.svc
    .from('dd_drawer_sessions')
    .select('id, opened_at')
    .eq('shop_id', body.shop_id)
    .is('closed_at', null)
    .maybeSingle()
  if (openSession) {
    return NextResponse.json({
      error: 'A drawer session is already open for this shop. Close it before opening a new one.',
      sessionId: openSession.id,
      openedAt: openSession.opened_at,
    }, { status: 409 })
  }

  const openedAt = resolveClientTime(body.opened_at)

  const { data, error } = await a.svc
    .from('dd_drawer_sessions')
    .insert({
      shop_id: body.shop_id,
      opened_by: body.user_id,
      opening_count: body.opening_count,
      client_key: clientKey,
      opened_at: openedAt.iso,
    })
    .select('id, opened_at')
    .single()
  if (error) {
    // Lost a race with this device's own concurrent replay: the unique index
    // on (shop_id, client_key) fired. Return the winner.
    if (clientKey && error.code === '23505') {
      const { data: raced } = await a.svc
        .from('dd_drawer_sessions')
        .select('id, opened_at')
        .eq('shop_id', body.shop_id)
        .eq('client_key', clientKey)
        .maybeSingle()
      if (raced) return NextResponse.json({ session: raced, replayed: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({
    session: data,
    // Surfaced so a register with a bad clock can be spotted rather than
    // quietly mis-dating its drawers.
    openedAtRejected: openedAt.accepted ? undefined : (openedAt.reason ?? 'defaulted'),
  })
}

// PATCH /api/pos/drawer-sessions — close. Body: { session_id, user_id, closing_count }
// Server computes expected cash from sales since opened_at + opening_count.
interface PatchBody {
  session_id: string
  user_id: string
  closing_count: number
  /** When the drawer actually closed, for a replayed offline close. */
  closed_at?: string | null
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
  if (!body.session_id || !body.user_id || body.closing_count == null) {
    return NextResponse.json({ error: 'session_id, user_id, closing_count required' }, { status: 400 })
  }
  if (!Number.isFinite(body.closing_count) || body.closing_count < 0) {
    return NextResponse.json({ error: 'closing_count must be a non-negative number' }, { status: 400 })
  }

  // Server computes expected cash for accuracy. Same math the client
  // was running before — opening + cash sales − refunds.
  const { data: session } = await a.svc
    .from('dd_drawer_sessions')
    .select('opening_count, opened_at, shop_id, closed_at, expected_cash, over_short')
    .eq('id', body.session_id)
    .maybeSingle()
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  // Already closed: hand back what was stored instead of recomputing. A
  // replay must not overwrite a close — and recomputing now would use a
  // different sales window and produce a different over/short for the same
  // physical count, which is the sort of drift that makes a cash report
  // impossible to argue with.
  const closedRow = session as { closed_at: string | null; expected_cash: number | null; over_short: number | null }
  if (closedRow.closed_at) {
    return NextResponse.json({
      expected: Number(closedRow.expected_cash ?? 0),
      overShort: Number(closedRow.over_short ?? 0),
      replayed: true,
    })
  }

  // Cross-shop guard: a shop_owner may only close their own shop's drawer.
  if (a.caller.role === 'shop_owner') {
    const { data: ownedShop } = await a.svc
      .from('dd_shops')
      .select('id')
      .eq('id', (session as { shop_id: string }).shop_id)
      .eq('owner_id', a.caller.id)
      .maybeSingle()
    if (!ownedShop) return NextResponse.json({ error: 'You do not own this shop' }, { status: 403 })
  }

  // Resolved before the sales query, because the query's upper bound is this
  // timestamp.
  const closedAt = resolveClientTime(body.closed_at)

  const { data: sales } = await a.svc
    .from('dd_orders')
    .select('total, refund_amount')
    .eq('shop_id', (session as { shop_id: string }).shop_id)
    .eq('order_type', 'pos_walkin')
    .eq('payment_method', 'cash')
    .neq('status', 'cancelled')
    .gte('created_at', (session as { opened_at: string }).opened_at)
    // Upper bound as well as lower. Without it, any sale landing after this
    // drawer closed - a later sale, or one still queued on another register
    // - was swept into a drawer it was never in. With client timestamps on
    // sales this window is now the real trading period of the drawer.
    .lte('created_at', closedAt.iso)
  const cashSales = (sales ?? []).reduce(
    (sum, r: { total: number; refund_amount: number | null }) =>
      sum + Number(r.total) - Number(r.refund_amount ?? 0),
    0,
  )
  const expected = Math.round((Number((session as { opening_count: number }).opening_count) + cashSales) * 100) / 100
  const overShort = Math.round((body.closing_count - expected) * 100) / 100

  const { error } = await a.svc
    .from('dd_drawer_sessions')
    .update({
      closed_at: closedAt.iso,
      closed_by: body.user_id,
      closing_count: body.closing_count,
      expected_cash: expected,
      over_short: overShort,
    })
    .eq('id', body.session_id)
    // Only if still open, so two concurrent closes cannot both write.
    .is('closed_at', null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expected, overShort })
}
