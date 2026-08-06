// Shared pitch-aggregation logic. Used by:
//   - GET /api/admin/shops/[id]/pitch  (admin pitch viewer)
//   - GET /api/pitch/[slug]            (public claim landing)
//   - /api/cron/pitch-weekly           (recurring email outreach)
//
// Single source of truth for the headline numbers + dollar callout so
// every surface stays in sync (and the avg-ticket assumption stays
// defensible — there's exactly one place to change it).

import { createServiceClient } from '@/lib/supabase/server'

export interface PitchAggregate {
  shop: {
    id: string
    name: string
    slug: string
    city: string | null
    state: string | null
    is_claimed: boolean
  }
  window_days: number
  total_engagement: number
  unique_visitors: number
  counts: {
    search_impression: number
    page_view: number
    menu_item_view: number
    lost_order_click: number
    claim_link_click: number
  }
  annual_revenue_lost_dollars: number
  avg_ticket_assumption: number
  claim_url: string
  shop_url: string
}

// Conservative donut-shop ticket. Surfaced inline on every pitch
// surface so the merchant can audit "where does $672/yr come from?"
// against their own POS data.
const AVG_TICKET_DOLLARS = 14

const ORIGIN = 'https://donutdash.app'

export async function buildPitchForShopId(shopId: string): Promise<PitchAggregate | null> {
  const svc = createServiceClient()
  const { data: shop } = await svc
    .from('dd_shops')
    .select('id, name, slug, city, state, is_claimed')
    .eq('id', shopId)
    .maybeSingle()
  if (!shop) return null
  return aggregate(shop as PitchAggregate['shop'])
}

export async function buildPitchForSlug(slug: string): Promise<PitchAggregate | null> {
  const svc = createServiceClient()
  const { data: shop } = await svc
    .from('dd_shops')
    .select('id, name, slug, city, state, is_claimed')
    .eq('slug', slug)
    .maybeSingle()
  if (!shop) return null
  return aggregate(shop as PitchAggregate['shop'])
}

async function aggregate(shop: PitchAggregate['shop']): Promise<PitchAggregate> {
  const svc = createServiceClient()
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: events } = await svc
    .from('dd_shop_engagement')
    .select('kind, visitor_hash')
    .eq('shop_id', shop.id)
    .eq('was_unclaimed', true)
    .gte('created_at', cutoff)

  const counts: PitchAggregate['counts'] = {
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

  return {
    shop,
    window_days: 30,
    total_engagement: total,
    unique_visitors: uniqueVisitors.size,
    counts,
    annual_revenue_lost_dollars: Math.round(counts.lost_order_click * AVG_TICKET_DOLLARS * 12),
    avg_ticket_assumption: AVG_TICKET_DOLLARS,
    claim_url: `${ORIGIN}/claim/${shop.slug}`,
    shop_url: `${ORIGIN}/shops/${shop.slug}`,
  }
}

// Branded HTML for the recurring outreach email. CAN-SPAM compliant:
// includes recipient identification (subject line), sender identity
// (DonutDash + physical address), and an unsubscribe link tied to the
// recipient's token. Avg-ticket assumption is shown explicitly in the
// body so the merchant can audit it on first read.
export function buildPitchEmailHtml(pitch: PitchAggregate, unsubscribeUrl: string): string {
  const { shop, counts, total_engagement, unique_visitors, annual_revenue_lost_dollars, claim_url, avg_ticket_assumption } = pitch
  const dollarBlock = annual_revenue_lost_dollars > 0
    ? `
      <tr><td style="padding:16px 24px 8px;">
        <div style="background:#FEF3C7;border:1px solid #FCD34D;border-radius:10px;padding:18px;text-align:center;">
          <div style="font-size:11px;font-weight:800;letter-spacing:1px;color:#92400E;">ANNUAL REVENUE LOST</div>
          <div style="font-size:36px;font-weight:900;color:#92400E;letter-spacing:-1px;margin:4px 0;">$${annual_revenue_lost_dollars.toLocaleString()}</div>
          <div style="font-size:12px;color:#92400E;">${counts.lost_order_click.toLocaleString()} attempted orders × $${avg_ticket_assumption} avg ticket × 12 months</div>
        </div>
      </td></tr>`
    : ''

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F8F9FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1A1A2E;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F8F9FA;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.06);">

        <tr><td style="background:linear-gradient(135deg,#FF8C00 0%,#FFA940 100%);padding:24px 28px;color:#fff;">
          <div style="font-size:11px;font-weight:800;letter-spacing:1.5px;opacity:0.95;">CUSTOMERS ARE ALREADY LOOKING FOR</div>
          <div style="font-size:26px;font-weight:900;margin:6px 0 2px;line-height:1.1;">${escapeHtml(shop.name)}</div>
          <div style="font-size:14px;opacity:0.95;">${escapeHtml(shop.city ?? '')}${shop.city && shop.state ? ', ' : ''}${escapeHtml(shop.state ?? '')}</div>
        </td></tr>

        <tr><td style="padding:24px 28px 8px;text-align:center;">
          <div style="font-size:11px;font-weight:800;letter-spacing:1.5px;color:#6B7280;">IN THE LAST 30 DAYS</div>
          <div style="font-size:60px;font-weight:900;line-height:1;letter-spacing:-2px;color:#1A1A2E;margin:6px 0;">${total_engagement.toLocaleString()}</div>
          <div style="font-size:14px;color:#4B5563;">customer interactions with your shop on DonutDash</div>
        </td></tr>

        <tr><td style="padding:8px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F9FAFB;border-radius:10px;padding:8px 12px;">
            ${row('Appeared in donut searches', counts.search_impression)}
            ${row('Viewed your shop page', counts.page_view)}
            ${row('Opened your menu', counts.menu_item_view)}
            ${row('Tried to order — went to competitors', counts.lost_order_click, true)}
            ${row('Unique people', unique_visitors)}
          </table>
        </td></tr>

        ${dollarBlock}

        <tr><td style="padding:20px 28px;text-align:center;">
          <a href="${claim_url}" style="display:inline-block;background:#FF8C00;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:800;font-size:16px;">
            Claim Your Shop →
          </a>
          <div style="margin-top:10px;font-size:12px;color:#9CA3AF;">~30 seconds. Free. No monthly fee.</div>
        </td></tr>

        <tr><td style="padding:12px 28px 24px;border-top:1px solid #F3F4F6;">
          <p style="font-size:11px;color:#9CA3AF;line-height:1.5;margin:0;">
            All numbers are real anonymous interactions tracked on donutdash.app over the last 30 days.
            Dollar estimate uses a $${avg_ticket_assumption} avg ticket — common for donut-shop transactions.
          </p>
        </td></tr>

      </table>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;margin-top:16px;">
        <tr><td style="text-align:center;font-size:11px;color:#9CA3AF;line-height:1.6;padding:0 12px;">
          DonutDash&trade; · Tyler, TX · <a href="mailto:hello@donutdash.app" style="color:#9CA3AF;">hello@donutdash.app</a><br>
          You're receiving this because you operate a donut shop listed on DonutDash.<br>
          <a href="${unsubscribeUrl}" style="color:#9CA3AF;text-decoration:underline;">Unsubscribe from future outreach</a>
        </td></tr>
      </table>

    </td></tr>
  </table>
</body>
</html>`
}

function row(label: string, count: number, highlight = false): string {
  return `<tr>
    <td style="padding:6px 4px;font-size:13px;color:${highlight ? '#1A1A2E' : '#4B5563'};font-weight:${highlight ? 700 : 500};">${escapeHtml(label)}</td>
    <td style="padding:6px 4px;text-align:right;font-size:14px;font-weight:800;color:${highlight ? '#FF8C00' : '#1A1A2E'};">${count.toLocaleString()}</td>
  </tr>`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
