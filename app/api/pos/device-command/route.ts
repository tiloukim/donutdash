import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/pos/device-command → queue a one-shot command for a POS device.
// The device picks it up on its next heartbeat (~45s) and clears it. Same
// shop-scoped auth as the rest of /api/pos/* — admin/manager, or the shop
// owner. Only whitelisted commands are accepted.

const ALLOWED = new Set(['reboot'])

async function authorizeForShop(shopId: string) {
  const auth = await createClient()
  const { data: { user }, error } = await auth.auth.getUser()
  if (error || !user) return { error: 'Unauthorized', status: 401 as const }
  const svc = createServiceClient()
  const { data: caller } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
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

interface Body {
  shop_id: string
  device_id: string
  command: string
}

export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.shop_id || !body.device_id || !body.command) {
    return NextResponse.json({ error: 'shop_id, device_id, command required' }, { status: 400 })
  }
  if (!ALLOWED.has(body.command)) {
    return NextResponse.json({ error: `Unsupported command: ${body.command}` }, { status: 400 })
  }

  const a = await authorizeForShop(body.shop_id)
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  const { error } = await a.svc
    .from('dd_pos_devices')
    .update({ pending_command: body.command })
    .eq('shop_id', body.shop_id)
    .eq('device_id', body.device_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
