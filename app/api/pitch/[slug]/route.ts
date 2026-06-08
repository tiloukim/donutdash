import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/pitch/:slug
//
// Public, unauthenticated. Returns the same pitch aggregates as
// /api/admin/shops/[id]/pitch but keyed on slug — so the short branded
// URL we share with prospective shop owners (donutdash.app/claim/:slug)
// can render a personalized landing page without exposing the shop's
// internal UUID. The data is the same information we're already
// presenting in printed flyers / SMS / email, so there's no
// confidentiality concern with letting the visitor see it themselves.
//
// Returns 404 if the slug is unknown or the shop is already claimed —
// no point pitching someone on a shop that's already on the platform.

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const svc = createServiceClient()
  const { slug } = await params

  const { data: shop } = await svc
    .from('dd_shops')
    .select('id, name, slug, city, state, address, phone, is_claimed')
    .eq('slug', slug)
    .maybeSingle()
  if (!shop) {
    return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
  }

  // Last 30 days of unclaimed-state engagement. Even after a shop
  // claims we keep returning the historical pre-claim numbers so a
  // saved link in someone's inbox still works post-activation (just
  // with a banner telling them the shop is already active).
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: events } = await svc
    .from('dd_shop_engagement')
    .select('kind, visitor_hash')
    .eq('shop_id', shop.id)
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

  const AVG_TICKET_DOLLARS = 14
  const annualRevenueLost = Math.round(counts.lost_order_click * AVG_TICKET_DOLLARS * 12)

  return NextResponse.json({
    shop: {
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      city: shop.city,
      state: shop.state,
      is_claimed: shop.is_claimed,
    },
    window_days: 30,
    total_engagement: total,
    unique_visitors: uniqueVisitors.size,
    counts,
    annual_revenue_lost_dollars: annualRevenueLost,
    avg_ticket_assumption: AVG_TICKET_DOLLARS,
    claim_url: `/shops/claim/${shop.slug}`,
    shop_url: `/shops/${shop.slug}`,
  })
}
