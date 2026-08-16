import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

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

// POST /api/pos/drawer-sessions — open a session with the starting count.
interface PostBody {
  shop_id: string
  user_id: string
  opening_count: number
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

  const { data, error } = await a.svc
    .from('dd_drawer_sessions')
    .insert({
      shop_id: body.shop_id,
      opened_by: body.user_id,
      opening_count: body.opening_count,
    })
    .select('id, opened_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ session: data })
}

// PATCH /api/pos/drawer-sessions — close. Body: { session_id, user_id, closing_count }
// Server computes expected cash from sales since opened_at + opening_count.
interface PatchBody {
  session_id: string
  user_id: string
  closing_count: number
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
    .select('opening_count, opened_at, shop_id')
    .eq('id', body.session_id)
    .maybeSingle()
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

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

  const { data: sales } = await a.svc
    .from('dd_orders')
    .select('total, refund_amount')
    .eq('shop_id', (session as { shop_id: string }).shop_id)
    .eq('order_type', 'pos_walkin')
    .eq('payment_method', 'cash')
    .neq('status', 'cancelled')
    .gte('created_at', (session as { opened_at: string }).opened_at)
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
      closed_at: new Date().toISOString(),
      closed_by: body.user_id,
      closing_count: body.closing_count,
      expected_cash: expected,
      over_short: overShort,
    })
    .eq('id', body.session_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expected, overShort })
}
