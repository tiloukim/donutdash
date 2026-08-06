import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/pos/heartbeat            → a POS device reports it's alive
// GET  /api/pos/heartbeat?shop_id=…  → list a shop's devices + online state
//
// Lightweight presence tracking for the POS fleet. Each install (Elo /
// tablet) POSTs every ~45s while open; we stamp last_seen_at. A device is
// "online" if seen within ONLINE_THRESHOLD. Rows are keyed on
// (shop_id, device_id) to match dd_shop_terminal_credentials — one row per
// physical register. Same shop-scoped auth model as terminal-credentials.

// A device seen within this window counts as online. Two missed 45s
// heartbeats (plus slack) — long enough to ride out a brief WiFi blip,
// short enough that a powered-off Elo drops offline within ~2 min.
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000

async function authorizeForShop(shopId: string) {
  const auth = await createClient()
  const { data: { user }, error } = await auth.auth.getUser()
  if (error || !user) return { error: 'Unauthorized', status: 401 as const }
  const svc = createServiceClient()

  const { data: caller } = await svc
    .from('dd_users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()
  if (!caller) return { error: 'No DonutDash profile', status: 403 as const }

  if (caller.role !== 'admin' && caller.role !== 'general_manager' && caller.role !== 'field_manager') {
    // Shop owner — verify they own this specific shop. Any other role
    // (driver, customer) is rejected.
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

interface HeartbeatBody {
  shop_id: string
  device_id: string
  register_label?: string | null
  platform?: string | null
  app_version?: string | null
  card_terminal_tpn?: string | null
  card_terminal_connected?: boolean | null
  card_terminal_checked_at?: string | null
}

export async function POST(req: NextRequest) {
  let body: HeartbeatBody
  try {
    body = (await req.json()) as HeartbeatBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.shop_id || !body.device_id) {
    return NextResponse.json({ error: 'shop_id and device_id required' }, { status: 400 })
  }

  const a = await authorizeForShop(body.shop_id)
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  // Upsert bumps last_seen_at to now on every beat; created_at only sticks
  // on the first insert (it's a column default, left out of the update set).
  const { error } = await a.svc
    .from('dd_pos_devices')
    .upsert(
      {
        shop_id: body.shop_id,
        device_id: body.device_id,
        register_label: body.register_label?.trim() || null,
        platform: body.platform?.trim() || null,
        app_version: body.app_version?.trim() || null,
        card_terminal_tpn: body.card_terminal_tpn?.trim() || null,
        card_terminal_connected: body.card_terminal_connected ?? null,
        card_terminal_checked_at: body.card_terminal_checked_at || null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'shop_id,device_id' },
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// Stamp each row with an `online` flag from its last_seen_at.
function withOnline<T extends { last_seen_at: string }>(rows: T[] | null) {
  const now = Date.now()
  return (rows ?? []).map((d) => ({
    ...d,
    online: now - new Date(d.last_seen_at).getTime() < ONLINE_THRESHOLD_MS,
  }))
}

export async function GET(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get('shop_id')

  // With shop_id → that shop's devices (owner or admin/manager).
  if (shopId) {
    const a = await authorizeForShop(shopId)
    if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })
    const { data, error } = await a.svc
      .from('dd_pos_devices')
      .select('*')
      .eq('shop_id', shopId)
      .order('last_seen_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ devices: withOnline(data) })
  }

  // No shop_id → admin/manager fleet overview across every shop, with the
  // shop name embedded for grouping. Not available to shop owners (they must
  // scope to their own shop_id).
  const auth = await createClient()
  const { data: { user }, error: uErr } = await auth.auth.getUser()
  if (uErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const svc = createServiceClient()
  const { data: caller } = await svc
    .from('dd_users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()
  if (!caller || !['admin', 'general_manager', 'field_manager'].includes(caller.role)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }
  const { data, error } = await svc
    .from('dd_pos_devices')
    .select('*, shop:dd_shops(name)')
    .order('last_seen_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ devices: withOnline(data) })
}
