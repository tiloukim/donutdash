import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerShop as getActiveShop } from '@/lib/shop-auth'

async function getShop() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthorized' as const }
  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) return { error: 'unauthorized' as const }
  const shop = await getActiveShop(svc, ddUser.id)
  if (!shop) return { error: 'no_shop' as const, svc }
  return { shop, svc }
}

export async function GET() {
  const ctx = await getShop()
  if ('error' in ctx && ctx.error === 'unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ('error' in ctx && ctx.error === 'no_shop') return NextResponse.json({ error: 'No shop found' }, { status: 404 })
  return NextResponse.json(ctx.shop)
}

export async function PUT(req: Request) {
  const ctx = await getShop()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.error === 'no_shop' ? 404 : 401 })

  const body = await req.json()
  const allowed = ['name', 'description', 'address', 'city', 'state', 'zip', 'country', 'phone', 'delivery_fee', 'min_order', 'service_fee_pct', 'image_url', 'banner_url', 'lat', 'lng', 'tax_id', 'rewards_enabled', 'reward_prompt_customer']
  const updates: Record<string, any> = {}
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key]
  }

  // Reward rates decide what the shop pays out on every sale, so they are
  // clamped here rather than taken on trust. These arrive from a form the shop
  // owner controls, and a typo — or a crafted request — that set the rate to
  // 50000 bps would quietly commit them to giving away five times the sale.
  //
  // Each is read as an integer and bounded; anything unparseable is dropped
  // rather than written as NaN or null, which would make dd_cash_earn read a
  // missing rate as zero and silently stop rewarding anyone.
  const clampInt = (v: unknown, lo: number, hi: number): number | undefined => {
    const n = Math.round(Number(v))
    if (!Number.isFinite(n)) return undefined
    return Math.min(hi, Math.max(lo, n))
  }
  // 0–2000 bps = 0%–20%. Above that is not a rewards programme.
  for (const key of ['reward_new_customer_bps', 'reward_standard_bps']) {
    if (body[key] === undefined) continue
    const n = clampInt(body[key], 0, 2000)
    if (n !== undefined) updates[key] = n
  }
  for (const key of ['reward_min_purchase_cents', 'reward_max_redeem_cents']) {
    if (body[key] === undefined) continue
    const n = clampInt(body[key], 0, 1_000_000)   // $10,000 ceiling
    if (n !== undefined) updates[key] = n
  }
  if (body.rewards_enabled !== undefined) updates.rewards_enabled = !!body.rewards_enabled
  if (body.reward_prompt_customer !== undefined) updates.reward_prompt_customer = !!body.reward_prompt_customer
  const { data, error } = await ctx.svc.from('dd_shops').update(updates).eq('id', ctx.shop.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
