import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { SquareClient, SquareEnvironment } from 'square'
import { SPONSOR_PLANS, getSponsorPlan } from '@/lib/sponsorship'
import { notifyAdmins } from '@/lib/sms'
import { resolveOwnerShop as getActiveShop } from '@/lib/shop-auth'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

function getSquareClient() {
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN!,
    environment: process.env.SQUARE_ENVIRONMENT === 'production'
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox,
  })
}

// Resolve the shop owned by the signed-in shop_owner (or admin acting on their
// own shop). Returns { svc, shop } or a NextResponse error.
async function resolveOwnerShop() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role, email').eq('auth_id', user.id).maybeSingle()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  const shop = await getActiveShop(svc, ddUser.id)
  if (!shop) return { error: NextResponse.json({ error: 'No shop found for this account' }, { status: 404 }) }

  return { svc, shop, ddUser }
}

// GET — current sponsorship status + the plans on offer.
export async function GET() {
  const r = await resolveOwnerShop()
  if ('error' in r) return r.error
  const { svc, shop } = r

  const liveSponsor = !!shop.is_sponsored &&
    (!shop.sponsor_expires_at || new Date(shop.sponsor_expires_at) > new Date())

  const { data: history } = await svc
    .from('dd_sponsorship_orders')
    .select('plan, amount, days, starts_at, ends_at, created_at')
    .eq('shop_id', shop.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({
    shopName: shop.name,
    sponsored: liveSponsor,
    sponsor_expires_at: shop.sponsor_expires_at,
    sponsor_headline: shop.sponsor_headline,
    sponsor_banner_url: shop.sponsor_banner_url,
    plans: SPONSOR_PLANS,
    history: history || [],
  })
}

// POST — buy a plan: charge the card via Square, then activate/extend the
// feature on success.
export async function POST(request: NextRequest) {
  const r = await resolveOwnerShop()
  if ('error' in r) return r.error
  const { svc, shop } = r

  const body = await request.json()
  const { plan: planId, sourceId, verificationToken, headline, banner_url } = body

  const plan = getSponsorPlan(planId)
  if (!plan) return NextResponse.json({ error: 'Unknown plan' }, { status: 400 })
  if (!sourceId) return NextResponse.json({ error: 'Missing payment token' }, { status: 400 })

  // Charge the shop owner's card into the platform Square account.
  const square = getSquareClient()
  let paymentId: string | undefined
  try {
    const result = await square.payments.create({
      sourceId,
      idempotencyKey: crypto.randomUUID(),
      amountMoney: { amount: BigInt(Math.round(plan.price * 100)), currency: 'USD' },
      locationId: process.env.SQUARE_LOCATION_ID!,
      note: `DonutDash Sponsorship — ${shop.name} — ${plan.label}`,
      ...(verificationToken ? { verificationToken } : {}),
    })
    if (result.payment?.status !== 'COMPLETED') throw new Error('not completed')
    paymentId = result.payment.id
  } catch (payErr) {
    const e = payErr as { errors?: { code?: string }[]; body?: { errors?: { code?: string }[] } }
    const codes = [
      ...(Array.isArray(e?.errors) ? e.errors.map(x => x.code) : []),
      ...(Array.isArray(e?.body?.errors) ? e.body!.errors!.map(x => x.code) : []),
    ]
    let message = 'Payment could not be completed. Please check your card details or try another card.'
    if (codes.includes('CVV_FAILURE')) message = 'Card declined — the security code (CVV) is incorrect.'
    else if (codes.includes('INSUFFICIENT_FUNDS')) message = 'Card declined — insufficient funds.'
    else if (codes.includes('CARD_EXPIRED') || codes.includes('INVALID_EXPIRATION')) message = 'Card declined — expired or invalid expiration date.'
    else if (codes.includes('GENERIC_DECLINE') || codes.includes('CARD_DECLINED')) message = 'Card declined. Please try a different card.'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  // Extend from the later of "now" or an existing un-expired feature, so paying
  // while already featured adds time rather than shortening it.
  const now = Date.now()
  const existingEnd = shop.sponsor_expires_at ? new Date(shop.sponsor_expires_at).getTime() : 0
  const startMs = Math.max(now, existingEnd)
  const endsAt = new Date(startMs + plan.days * 24 * 60 * 60 * 1000).toISOString()

  const update: Record<string, unknown> = {
    is_sponsored: true,
    sponsor_rank: Math.max(shop.sponsor_rank ?? 0, plan.rank),
    sponsor_expires_at: endsAt,
  }
  if (typeof headline === 'string' && headline.trim()) update.sponsor_headline = headline.trim().slice(0, 120)
  if (typeof banner_url === 'string' && banner_url.trim()) update.sponsor_banner_url = banner_url.trim()

  const { error: updErr } = await svc.from('dd_shops').update(update).eq('id', shop.id)
  if (updErr) {
    // Paid but couldn't activate — log loudly so it can be reconciled.
    console.error('[sponsorship] PAID but activation failed — reconcile', { shopId: shop.id, paymentId, updErr })
    return NextResponse.json({ error: 'Payment succeeded but activation failed — please contact support.' }, { status: 500 })
  }

  await svc.from('dd_sponsorship_orders').insert({
    shop_id: shop.id,
    plan: plan.id,
    amount: plan.price,
    days: plan.days,
    payment_id: paymentId,
    starts_at: new Date(startMs).toISOString(),
    ends_at: endsAt,
  })

  notifyAdmins(
    `New sponsorship: ${shop.name} bought ${plan.label} ($${plan.price}). Featured until ${new Date(endsAt).toLocaleDateString()}.`,
    `Sponsorship purchased — ${shop.name}`,
    `<p><strong>${shop.name}</strong> purchased the <strong>${plan.label}</strong> sponsorship ($${plan.price}).</p><p>Featured until ${new Date(endsAt).toLocaleString()}.</p>`,
  ).catch(() => {})

  return NextResponse.json({ ok: true, sponsored: true, sponsor_expires_at: endsAt })
}
