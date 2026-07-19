import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { buildReceiptHtml, fetchReceiptData } from '@/lib/receipt'

// POST /api/pos/receipt/email
//
// Body: { orderId: string, email: string }
//
// Send a customer-facing receipt email for a POS sale via Resend. The
// caller is authenticated via Bearer token (same flow as /api/pos/orders);
// we verify they own (or are admin for) the shop the order belongs to.
// The receipt HTML is shared with the public /receipt/[id] web view via
// lib/receipt.ts so both always match.
//
// Returns:
//   200 { success: true } — email queued with Resend
//   400 — bad body / invalid email
//   401 — no auth
//   403 — caller doesn't own the shop
//   404 — order not found
//   500 — Resend error

export const dynamic = 'force-dynamic'

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(req: NextRequest) {
  // — Auth: Bearer token via mobile POS, same as /api/pos/orders.
  const auth = await createClient()
  const { data: userRes, error: userErr } = await auth.auth.getUser()
  if (userErr || !userRes?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const authId = userRes.user.id

  // — Body
  let body: { orderId?: string; email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const orderId = String(body.orderId ?? '').trim()
  const email = String(body.email ?? '').trim().toLowerCase()
  if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
  }

  const svc = createServiceClient()

  // — Authorize: shop_owner of this shop, or admin.
  const { data: profile } = await svc
    .from('dd_users')
    .select('id, role')
    .eq('auth_id', authId)
    .maybeSingle()
  if (!profile) {
    return NextResponse.json({ error: 'No DonutDash profile' }, { status: 403 })
  }

  const receipt = await fetchReceiptData(svc, orderId)
  if (!receipt) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  const { order, items, shop } = receipt

  if (profile.role !== 'admin') {
    const { data: ownShop } = await svc
      .from('dd_shops')
      .select('id')
      .eq('id', order.shop_id)
      .eq('owner_id', profile.id)
      .maybeSingle()
    if (!ownShop) {
      return NextResponse.json({ error: 'You do not own this shop' }, { status: 403 })
    }
  }

  // — Render HTML + send via Resend.
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
  }

  const html = buildReceiptHtml(order, items, shop, { sentToEmail: email })
  const subject = `Your receipt from ${shop.name}${order.short_code ? ` · Order #${order.short_code}` : ''}`

  // Use the shop name as the From display, keep the verified Resend
  // address. RESEND_FROM_EMAIL can be either "Name <a@b>" or just
  // "a@b" — extract the address part either way.
  const envFrom = process.env.RESEND_FROM_EMAIL ?? 'DonutDash <notifications@donutdash.app>'
  const addressMatch = envFrom.match(/<([^>]+)>/)
  const fromAddress = addressMatch ? addressMatch[1] : envFrom.trim()
  // Strip characters that would break the "Name <addr>" header.
  const fromDisplayName = shop.name.replace(/[<>"\r\n]/g, '').trim() || 'DonutDash'

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromDisplayName} <${fromAddress}>`,
        to: email,
        subject,
        html,
      }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('Resend error', res.status, text)
      return NextResponse.json({ error: 'Failed to send receipt email' }, { status: 502 })
    }
  } catch (e) {
    console.error('Resend exception', e)
    return NextResponse.json({ error: 'Failed to send receipt email' }, { status: 502 })
  }

  return NextResponse.json({ success: true })
}
