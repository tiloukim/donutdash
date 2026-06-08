import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/admin/shops/:id/pitch
//
// Returns the pitch-pack for a specific shop: basic info + 30-day
// engagement aggregates from dd_shop_engagement. Powers the
// /admin/shops/:id/pitch screen.
//
// All counts are filtered to was_unclaimed=true so we count
// demand-while-unclaimed even after the shop activates — the pitch
// works equally well for retroactively showing a now-claimed shop
// "look at the demand you had before you turned this on."
//
// Admin / manager auth required. Returns 403 otherwise.

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: caller } = await svc
    .from('dd_users')
    .select('role')
    .eq('auth_id', user.id)
    .single()
  if (!caller || (caller.role !== 'admin' && caller.role !== 'manager')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: shopId } = await params

  // Shop basics. We need is_claimed so the UI can flag "this shop is
  // already claimed — pitch view is read-only/historical."
  const { data: shop, error: shopErr } = await svc
    .from('dd_shops')
    .select('id, name, slug, city, state, address, phone, is_claimed, owner_id')
    .eq('id', shopId)
    .maybeSingle()
  if (shopErr || !shop) {
    return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
  }

  // Aggregate the last 30 days of unclaimed-state engagement events.
  // SELECT raw events + roll up in JS rather than running 6 separate
  // count queries — for a single shop this is cheaper than 6 round
  // trips and keeps the math obvious.
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: events } = await svc
    .from('dd_shop_engagement')
    .select('kind, visitor_hash, created_at')
    .eq('shop_id', shopId)
    .eq('was_unclaimed', true)
    .gte('created_at', cutoff)

  const counts = {
    search_impression: 0,
    page_view: 0,
    menu_item_view: 0,
    lost_order_click: 0,
    claim_link_click: 0,
  }
  const uniqueVisitors = new Set<string>()
  let total = 0
  for (const e of (events ?? []) as Array<{ kind: string; visitor_hash: string | null }>) {
    total += 1
    if (e.kind in counts) counts[e.kind as keyof typeof counts] += 1
    if (e.visitor_hash) uniqueVisitors.add(e.visitor_hash)
  }

  // Dollar headline at the conservative donut-shop avg ticket. We keep
  // the multiplier as a constant rather than per-shop so the pitch is
  // defensible — every number on the flyer ties to a publicly stated
  // assumption (avg ticket + months) rather than ad-hoc per-shop math.
  const AVG_TICKET_DOLLARS = 14
  const annualRevenueLost = Math.round(counts.lost_order_click * AVG_TICKET_DOLLARS * 12)

  return NextResponse.json({
    shop: {
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      city: shop.city,
      state: shop.state,
      address: shop.address,
      phone: shop.phone,
      is_claimed: shop.is_claimed,
    },
    window_days: 30,
    total_engagement: total,
    unique_visitors: uniqueVisitors.size,
    counts,
    annual_revenue_lost_dollars: annualRevenueLost,
    avg_ticket_assumption: AVG_TICKET_DOLLARS,
    // Short branded URL we send in outreach SMS / email / flyer. It
    // renders the personalized pitch landing and then CTAs into the
    // full /shops/claim/:slug form.
    claim_url: `https://donutdash.app/claim/${shop.slug}`,
    shop_url: `https://donutdash.app/shops/${shop.slug}`,
  })
}
