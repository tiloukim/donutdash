import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendSMS, toE164 } from '@/lib/sms'
import { checkRateLimit } from '@/lib/rate-limit'

// POST /api/pos/receipt/sms
//
// Body: { orderId: string, phone: string }
//
// Text a customer the receipt for a POS sale via Telnyx (sendSMS — Telnyx
// primary, Twilio fallback). Same auth shape as /api/pos/receipt/email: the
// caller must own (or be admin for) the shop the order belongs to. Renders a
// plain-text receipt (SMS has no HTML).
//
// Returns:
//   200 { success: true }
//   400 — bad body / unsendable phone
//   401 — no auth
//   403 — caller doesn't own the shop
//   404 — order not found
//   429 — rate limited
//   502 — SMS provider failed

export const dynamic = 'force-dynamic'

interface OrderRow {
  id: string
  shop_id: string
  short_code: string | null
  subtotal: number
  tax: number
  tip: number | null
  total: number
  payment_method: string | null
  cash_received: number | null
  change_given: number | null
  cash_discount_amount: number | null
}

interface OrderItem {
  name: string
  quantity: number
  price: number | null
}

function money(n: number | null | undefined): string {
  return `$${Number(n ?? 0).toFixed(2)}`
}

// Plain-text receipt for SMS. Mirrors the email receipt's breakdown, including
// the card surcharge derived from stored fields (total = subtotal + tax + tip
// − cash_discount + surcharge), so the lines add up to the total.
function buildReceiptText(order: OrderRow, items: OrderItem[], shopName: string): string {
  const lines: string[] = []
  lines.push(`${shopName}${order.short_code ? ` #${order.short_code}` : ''}`)
  for (const it of items) {
    lines.push(`${it.quantity}x ${it.name} ${money((it.price ?? 0) * it.quantity)}`)
  }
  lines.push(`Subtotal ${money(order.subtotal)}`)

  const cashDiscount = Number(order.cash_discount_amount ?? 0)
  if (cashDiscount > 0) lines.push(`Cash Discount -${money(cashDiscount)}`)

  lines.push(`Tax ${money(order.tax)}`)

  const tip = Number(order.tip ?? 0)
  const surcharge =
    Math.round((Number(order.total) - Number(order.subtotal) - Number(order.tax) - tip + cashDiscount) * 100) / 100
  if (surcharge > 0.005) lines.push(`Card Surcharge ${money(surcharge)}`)
  if (tip > 0) lines.push(`Tip ${money(tip)}`)

  const paymentLabel = order.payment_method === 'cash' ? 'Cash' : 'Card'
  lines.push(`Total ${money(order.total)} (${paymentLabel})`)

  if (order.payment_method === 'cash' && order.cash_received != null) {
    lines.push(`Cash ${money(order.cash_received)} / Change ${money(order.change_given)}`)
  }
  lines.push('Thank you!')
  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  const auth = await createClient()
  const { data: userRes, error: userErr } = await auth.auth.getUser()
  if (userErr || !userRes?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const authId = userRes.user.id

  let body: { orderId?: string; phone?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const orderId = String(body.orderId ?? '').trim()
  const phone = toE164(body.phone)
  if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
  if (!phone) return NextResponse.json({ error: 'A valid mobile number is required' }, { status: 400 })

  const svc = createServiceClient()

  // — Authorize: shop_owner of this shop, or admin. Same pattern as
  //   /api/pos/receipt/email.
  const { data: profile } = await svc
    .from('dd_users')
    .select('id, role')
    .eq('auth_id', authId)
    .maybeSingle()
  if (!profile) {
    return NextResponse.json({ error: 'No DonutDash profile' }, { status: 403 })
  }

  // SMS-pump defense: cap per caller. Telnyx charges per segment.
  const limit = await checkRateLimit(`receipt-sms:${profile.id}`, 30, 60 * 60_000)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many texted receipts. Try again later.' }, { status: 429 })
  }

  const { data: order, error: orderErr } = await svc
    .from('dd_orders')
    .select(`
      id, shop_id, short_code, subtotal, tax, tip, total,
      payment_method, cash_received, change_given, cash_discount_amount
    `)
    .eq('id', orderId)
    .maybeSingle<OrderRow>()
  if (orderErr || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (profile.role !== 'admin') {
    const { data: shop } = await svc
      .from('dd_shops')
      .select('id')
      .eq('id', order.shop_id)
      .eq('owner_id', profile.id)
      .maybeSingle()
    if (!shop) {
      return NextResponse.json({ error: 'You do not own this shop' }, { status: 403 })
    }
  }

  const [itemsRes, shopRes] = await Promise.all([
    svc.from('dd_order_items').select('name, quantity, price').eq('order_id', orderId),
    svc.from('dd_shops').select('name').eq('id', order.shop_id).single<{ name: string }>(),
  ])
  if (itemsRes.error) {
    return NextResponse.json({ error: `Order items: ${itemsRes.error.message}` }, { status: 500 })
  }
  const items = (itemsRes.data ?? []) as OrderItem[]
  const shopName = shopRes.data?.name ?? 'Your order'

  const text = buildReceiptText(order, items, shopName)
  const ok = await sendSMS(phone, text)
  if (!ok) {
    return NextResponse.json({ error: 'Failed to send the receipt text' }, { status: 502 })
  }
  return NextResponse.json({ success: true })
}
