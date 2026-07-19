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
  card_brand: string | null
  card_last4: string | null
  cash_discount_amount: number | null
}

function money(n: number | null | undefined): string {
  return `$${Number(n ?? 0).toFixed(2)}`
}

// Short card-network label for SMS (no HTML/logos), e.g. "Visa ••4242".
function cardBrandText(brand: string | null, last4: string | null): string {
  const key = (brand ?? '').trim().toLowerCase().replace(/\s+/g, '')
  const map: Record<string, string> = {
    visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex', americanexpress: 'Amex',
    discover: 'Discover', diners: 'Diners', dinersclub: 'Diners', jcb: 'JCB', unionpay: 'UnionPay',
  }
  const label = map[key] ?? (brand || 'Card')
  return last4 ? `${label} ••${last4}` : label
}

// Short SMS: order summary + a link to the full styled web receipt
// (/receipt/[id] — same design as the emailed receipt). Kept brief to
// minimize SMS segments; the itemized breakdown + "Order again" button live
// on the linked page.
function buildReceiptText(order: OrderRow, shopName: string): string {
  const paymentLabel = order.payment_method === 'cash'
    ? 'Cash'
    : cardBrandText(order.card_brand, order.card_last4)
  return [
    `${shopName}${order.short_code ? ` #${order.short_code}` : ''}`,
    `Total ${money(order.total)} (${paymentLabel})`,
    `Receipt: https://donutdash.app/receipt/${order.id}`,
  ].join('\n')
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
      payment_method, cash_received, change_given,
      card_brand, card_last4, cash_discount_amount
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

  const { data: shopData } = await svc
    .from('dd_shops')
    .select('name')
    .eq('id', order.shop_id)
    .single<{ name: string }>()
  const shopName = shopData?.name ?? 'Your order'

  const text = buildReceiptText(order, shopName)
  const ok = await sendSMS(phone, text)
  if (!ok) {
    return NextResponse.json({ error: 'Failed to send the receipt text' }, { status: 502 })
  }
  return NextResponse.json({ success: true })
}
