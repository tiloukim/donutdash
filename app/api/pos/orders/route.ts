import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// Create a POS walk-in order. Writes go through the service role
// (matches how customer checkout and driver flows work today).
// The caller is authenticated via Bearer token; we verify they
// actually own the shop they're billing to before inserting.

interface CartLine {
  menu_item_id: string
  name: string
  price: number
  quantity: number
  special_instructions?: string | null
  image_url?: string | null
}

interface CreateBody {
  shop_id: string
  lines: CartLine[]
  subtotal: number
  tax: number
  total: number
  payment_method: 'cash' | 'card_manual'
  cash_received?: number
  change_given?: number
}

export async function POST(req: NextRequest) {
  const auth = await createClient()
  const { data: userRes, error: userErr } = await auth.auth.getUser()
  if (userErr || !userRes?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const authId = userRes.user.id

  let body: CreateBody
  try {
    body = (await req.json()) as CreateBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.shop_id || !Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json({ error: 'shop_id and at least one line are required' }, { status: 400 })
  }

  const svc = createServiceClient()

  // Authorize: shop_owner of this shop, or admin.
  const { data: profile } = await svc
    .from('dd_users')
    .select('id, role')
    .eq('auth_id', authId)
    .maybeSingle()
  if (!profile) {
    return NextResponse.json({ error: 'No DonutDash profile' }, { status: 403 })
  }

  if (profile.role !== 'admin') {
    const { data: shop } = await svc
      .from('dd_shops')
      .select('id')
      .eq('id', body.shop_id)
      .eq('owner_id', profile.id)
      .maybeSingle()
    if (!shop) {
      return NextResponse.json({ error: 'You do not own this shop' }, { status: 403 })
    }
  }

  const { data: order, error } = await svc
    .from('dd_orders')
    .insert({
      shop_id: body.shop_id,
      staff_id: profile.id,
      order_type: 'pos_walkin',
      source: 'pos',
      // Walk-in sales are terminal the moment the customer pays — they're
      // already holding their food. 'delivered' is the existing terminal
      // status and keeps walk-ins out of the active-order workflow that
      // delivery/pickup orders move through.
      status: 'delivered',
      subtotal: body.subtotal,
      tax: body.tax,
      total: body.total,
      payment_method: body.payment_method,
      cash_received: body.cash_received ?? null,
      change_given: body.change_given ?? null,
    })
    .select('id, short_code')
    .single()

  if (error || !order) {
    return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 })
  }

  const items = body.lines.map((l) => ({
    order_id: order.id,
    menu_item_id: l.menu_item_id,
    name: l.name,
    price: l.price,
    quantity: l.quantity,
    special_instructions: l.special_instructions ?? null,
    image_url: l.image_url ?? null,
  }))

  const { error: itemsError } = await svc.from('dd_order_items').insert(items)
  if (itemsError) {
    // best-effort rollback of the parent row so the order doesn't linger empty
    await svc.from('dd_orders').delete().eq('id', order.id)
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  return NextResponse.json({ id: order.id, short_code: order.short_code })
}
