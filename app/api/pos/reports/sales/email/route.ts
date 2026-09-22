import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { assertPosAccess } from '@/lib/pos-shop-auth'
import { buildHtml, type SalesReportBody, type ShopRow } from '@/lib/sales-report-email'

// POST /api/pos/reports/sales/email
//
// Body: {
//   email: string,
//   shopId: string,
//   periodLabel: string,
//   compareLabel: string,
//   gross, net, refunds, count, averageSale, cashTotal, cardTotal: number,
//   grossChange, netChange, countChange, avgChange, cashChange, cardChange: number | null,
// }
//
// Same Bearer auth + shop-ownership check as /api/pos/receipt/email. The
// payload comes from the POS reports screen (already computed there) so
// we don't re-run aggregations server-side — just render + send.

export const dynamic = 'force-dynamic'

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(req: NextRequest) {
  // — Auth: Bearer token via mobile POS.
  const auth = await createClient()
  const { data: userRes, error: userErr } = await auth.auth.getUser()
  if (userErr || !userRes?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const authId = userRes.user.id

  let body: SalesReportBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const email = String(body.email ?? '').trim().toLowerCase()
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
  }
  if (!body.shopId) {
    return NextResponse.json({ error: 'shopId is required' }, { status: 400 })
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
  if (profile.role !== 'admin') {
    const { data: shop } = await svc
      .from('dd_shops')
      .select('id')
      .eq('id', body.shopId)
      .eq('owner_id', profile.id)
      .maybeSingle()
    if (!shop) {
      return NextResponse.json({ error: 'You do not own this shop' }, { status: 403 })
    }
  }

  const gate = await assertPosAccess(svc, profile.id, body.shopId)
  if (gate) return NextResponse.json({ error: gate.error }, { status: gate.status })

  // — Fetch shop for header / From display.
  const { data: shop, error: shopErr } = await svc
    .from('dd_shops')
    .select('id, name, address, city, state, zip, phone')
    .eq('id', body.shopId)
    .single<ShopRow>()
  if (shopErr || !shop) {
    return NextResponse.json({ error: `Shop info: ${shopErr?.message ?? 'not found'}` }, { status: 500 })
  }

  // — Send via Resend.
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
  }
  const html = buildHtml(body, shop)
  const subject = `Sales report · ${shop.name} · ${body.periodLabel}`

  // Shop name as From display (same pattern as /api/pos/receipt/email).
  const envFrom = process.env.RESEND_FROM_EMAIL ?? 'DonutDash <notifications@donutdash.app>'
  const addressMatch = envFrom.match(/<([^>]+)>/)
  const fromAddress = addressMatch ? addressMatch[1] : envFrom.trim()
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
      console.error('Resend error (sales report)', res.status, text)
      return NextResponse.json({ error: 'Failed to send report email' }, { status: 502 })
    }
  } catch (e) {
    console.error('Resend exception (sales report)', e)
    return NextResponse.json({ error: 'Failed to send report email' }, { status: 502 })
  }

  return NextResponse.json({ success: true })
}
