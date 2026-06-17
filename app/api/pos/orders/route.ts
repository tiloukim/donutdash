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
  /** Card-payment tip in dollars. 0 (or omitted) for cash sales. */
  tip?: number
  total: number
  payment_method: 'cash' | 'card_manual' | 'card_pax'
  cash_received?: number
  change_given?: number
  /** Walk-in customer captured at the register, or null for anon walk-in. */
  customer_id?: string | null
  /** Cash discount given on this sale (dollars). 0 on card sales. */
  cash_discount_amount?: number
  /** Card brand from the terminal (VISA, MASTERCARD, AMEX, …). Lets the
   *  Transactions screen show "Mastercard 1427" instead of generic Card. */
  card_brand?: string | null
  /** Last 4 of the PAN. Indexed on dd_orders so cashiers can search by it. */
  card_last4?: string | null
  /** Active cashier (dd_users.id). Defaults to the auth user when missing. */
  cashier_user_id?: string | null
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

  // Resolve the actual cashier — the PIN switcher hands the device
  // owner's session to multiple cashiers throughout a shift. Without
  // this, staff_id always points at the device owner and per-cashier
  // shift attribution is meaningless.
  let staffId = profile.id
  if (body.cashier_user_id && body.cashier_user_id !== profile.id) {
    const { data: cashierStaff } = await svc
      .from('dd_shop_staff')
      .select('user_id')
      .eq('shop_id', body.shop_id)
      .eq('user_id', body.cashier_user_id)
      .eq('status', 'active')
      .maybeSingle()
    if (!cashierStaff) {
      return NextResponse.json({ error: 'cashier_user_id is not an active cashier at this shop' }, { status: 400 })
    }
    staffId = body.cashier_user_id
  }

  // Reconcile totals server-side. The cashier can set custom per-line
  // prices (e.g. one-off discount), but body.subtotal must equal
  // sum(price × qty) and body.total must equal subtotal + tax + tip −
  // cash_discount. Without this, a malicious / buggy client can post
  // total=$0.01 for a $50 cart and wreck the drawer reconciliation.
  const recomputedSubtotal = body.lines.reduce(
    (s, l) => s + Number(l.price) * Number(l.quantity), 0,
  )
  const tip = Number(body.tip ?? 0)
  const tax = Number(body.tax ?? 0)
  const discount = Number(body.cash_discount_amount ?? 0)
  const recomputedTotal = recomputedSubtotal + tax + tip - discount
  const TOLERANCE = 0.01 // one cent of float wobble
  if (Math.abs(recomputedSubtotal - Number(body.subtotal)) > TOLERANCE) {
    return NextResponse.json({
      error: `subtotal mismatch: client ${body.subtotal}, server ${recomputedSubtotal.toFixed(2)}`,
    }, { status: 400 })
  }
  if (Math.abs(recomputedTotal - Number(body.total)) > TOLERANCE) {
    return NextResponse.json({
      error: `total mismatch: client ${body.total}, server ${recomputedTotal.toFixed(2)}`,
    }, { status: 400 })
  }

  const { data: order, error } = await svc
    .from('dd_orders')
    .insert({
      shop_id: body.shop_id,
      staff_id: staffId,
      customer_id: body.customer_id ?? null,
      order_type: 'pos_walkin',
      source: 'pos',
      // Walk-in sales are terminal the moment the customer pays — they're
      // already holding their food. 'delivered' is the existing terminal
      // status and keeps walk-ins out of the active-order workflow that
      // delivery/pickup orders move through.
      status: 'delivered',
      subtotal: Math.round(recomputedSubtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      tip: Math.round(tip * 100) / 100,
      total: Math.round(recomputedTotal * 100) / 100,
      payment_method: body.payment_method,
      cash_received: body.cash_received ?? null,
      change_given: body.change_given ?? null,
      cash_discount_amount: Math.round(discount * 100) / 100,
      card_brand: body.card_brand ?? null,
      card_last4: body.card_last4 ?? null,
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
