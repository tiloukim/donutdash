import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET  /api/pos/terminal-credentials?shop_id=<uuid>
// PUT  /api/pos/terminal-credentials
//
// Per-shop SPIn credential storage for the Dejavoo terminal integration.
// Authorized callers are admin or the shop_owner of that specific shop.
// POS app calls GET on first launch / Settings open to mirror creds
// into expo-secure-store; PUT propagates edits back to the backend so
// they survive APK reinstall + apply to every device at that shop.
//
// auth_key is sensitive — only ever returned to authorized callers
// over HTTPS, never logged, never embedded in URLs.

interface TerminalCredentials {
  shop_id: string
  tpn: string
  auth_key: string
  register_id: string | null
  environment: 'sandbox' | 'production'
  terminal_model: string | null
  tip_on_terminal: boolean
  print_on_terminal: boolean
  updated_at: string | null
}

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
    // Shop owner — verify they own this specific shop. We don't allow
    // any other role (driver, customer) to touch terminal creds even
    // for read.
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

export async function GET(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get('shop_id')
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const a = await authorizeForShop(shopId)
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  const { data, error } = await a.svc
    .from('dd_shop_terminal_credentials')
    .select('*')
    .eq('shop_id', shopId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Not-yet-configured is a normal state, not an error — the POS app
  // shows the configuration form. Return null so the client doesn't
  // have to special-case 404.
  return NextResponse.json({ credentials: (data as TerminalCredentials | null) ?? null })
}

interface PutBody {
  shop_id: string
  tpn: string
  auth_key: string
  register_id?: string | null
  environment: 'sandbox' | 'production'
  terminal_model?: string | null
  tip_on_terminal?: boolean
  print_on_terminal?: boolean
}

export async function PUT(req: NextRequest) {
  let body: PutBody
  try {
    body = (await req.json()) as PutBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.shop_id || !body.tpn || !body.auth_key || !body.environment) {
    return NextResponse.json({ error: 'shop_id, tpn, auth_key, environment required' }, { status: 400 })
  }
  if (body.environment !== 'sandbox' && body.environment !== 'production') {
    return NextResponse.json({ error: 'environment must be sandbox or production' }, { status: 400 })
  }

  const a = await authorizeForShop(body.shop_id)
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  const { error } = await a.svc
    .from('dd_shop_terminal_credentials')
    .upsert(
      {
        shop_id: body.shop_id,
        tpn: body.tpn.trim(),
        auth_key: body.auth_key.trim(),
        register_id: body.register_id?.trim() || null,
        environment: body.environment,
        terminal_model: body.terminal_model?.trim() || null,
        tip_on_terminal: body.tip_on_terminal ?? false,
        print_on_terminal: body.print_on_terminal ?? false,
        updated_by: a.caller.id,
      },
      { onConflict: 'shop_id' },
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — admin can wipe credentials remotely (e.g. credential rotation,
// shop closed, AuthKey compromised). Same auth model.
export async function DELETE(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get('shop_id')
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const a = await authorizeForShop(shopId)
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  const { error } = await a.svc
    .from('dd_shop_terminal_credentials')
    .delete()
    .eq('shop_id', shopId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
