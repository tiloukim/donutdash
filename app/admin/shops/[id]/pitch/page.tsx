'use client'

// Internal pitch one-pager for prospective shop owners. Aggregates the
// last 30 days of (was-unclaimed) engagement for the chosen shop and
// surfaces it as:
//   - a single headline number (real total events)
//   - an itemized customer-journey breakdown
//   - a dollar-amount annual-revenue callout
//   - copy-to-clipboard SMS + email templates pre-merged with the
//     shop's real numbers, ready to drop into Telnyx / Resend / a
//     printed flyer.
//
// Every number is sourced from dd_shop_engagement rows tied to real
// anonymous visitor interactions — no synthetic offsets. The pitch
// reads bigger naturally because impressions + page_views + menu opens
// + lost-order clicks aggregate, not because anything is invented.

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface PitchData {
  shop: {
    id: string
    name: string
    slug: string
    city: string | null
    state: string | null
    address: string | null
    phone: string | null
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

export default function ShopPitchPage() {
  const params = useParams()
  const router = useRouter()
  const shopId = params.id as string
  const [data, setData] = useState<PitchData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!shopId) return
    setLoading(true)
    fetch(`/api/admin/shops/${shopId}/pitch`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? `HTTP ${res.status}`)
        }
        return res.json() as Promise<PitchData>
      })
      .then(setData)
      .catch((e) => setErr(e?.message ?? 'Failed to load'))
      .finally(() => setLoading(false))
  }, [shopId])

  const smsText = useMemo(() => buildSmsText(data), [data])
  const emailSubject = useMemo(() => buildEmailSubject(data), [data])
  const emailBody = useMemo(() => buildEmailBody(data), [data])

  function copy(text: string, label: string) {
    if (!text) return
    navigator.clipboard.writeText(text).then(
      () => alert(`Copied ${label}`),
      () => alert('Copy failed'),
    )
  }

  if (loading) {
    return <div style={{ padding: 32, color: '#6B7280' }}>Loading pitch…</div>
  }
  if (err) {
    return <div style={{ padding: 32, color: '#EF4444' }}>{err}</div>
  }
  if (!data) return null

  const { shop, counts, total_engagement, unique_visitors, annual_revenue_lost_dollars, claim_url, shop_url } = data

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <button
            onClick={() => router.push('/admin/shops')}
            style={{ background: 'none', border: 'none', color: '#6366F1', fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 8 }}
          >
            ← Back to Shops
          </button>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1A1A2E', margin: 0 }}>{shop.name}</h1>
          <p style={{ margin: '4px 0 0 0', color: '#6B7280', fontSize: 14 }}>
            {shop.city ?? ''}{shop.city && shop.state ? ', ' : ''}{shop.state ?? ''}
            {shop.is_claimed ? (
              <span style={{ marginLeft: 12, background: '#10B981', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>
                CLAIMED
              </span>
            ) : (
              <span style={{ marginLeft: 12, background: '#F59E0B', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>
                UNCLAIMED
              </span>
            )}
          </p>
        </div>
        <Link
          href={shop_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 14px', color: '#1A1A2E', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}
        >
          Open shop page ↗
        </Link>
      </div>

      {/* Headline */}
      <div style={{ background: 'linear-gradient(135deg, #6366F1, #818CF8)', borderRadius: 12, padding: 32, color: '#fff', textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, opacity: 0.9, marginBottom: 8 }}>
          LAST 30 DAYS
        </div>
        <div style={{ fontSize: 72, fontWeight: 900, lineHeight: 1, letterSpacing: -2 }}>
          {total_engagement.toLocaleString()}
        </div>
        <div style={{ fontSize: 16, opacity: 0.95, marginTop: 8 }}>
          customer interactions with your shop on DonutDash
        </div>
      </div>

      {/* Customer journey breakdown */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1, color: '#6B7280', margin: '0 0 16px 0' }}>
          CUSTOMER JOURNEY
        </h3>
        <JourneyRow label="Appeared in donut searches" count={counts.search_impression} />
        <JourneyRow label="Viewed your shop page" count={counts.page_view} highlight={counts.page_view > 0} />
        <JourneyRow label="Opened your menu" count={counts.menu_item_view} />
        <JourneyRow label="Tried to order from you" count={counts.lost_order_click} highlight={counts.lost_order_click > 0} />
        <JourneyRow label='Tapped "Claim it"' count={counts.claim_link_click} />
        <div style={{ borderTop: '1px solid #F3F4F6', marginTop: 12, paddingTop: 12, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: '#6B7280', fontWeight: 600 }}>Unique visitors</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#1A1A2E' }}>{unique_visitors.toLocaleString()}</span>
        </div>
      </div>

      {/* Annual revenue callout */}
      {annual_revenue_lost_dollars > 0 && (
        <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1, color: '#92400E', marginBottom: 4 }}>
            ANNUAL REVENUE LOST TO COMPETITORS
          </div>
          <div style={{ fontSize: 42, fontWeight: 900, color: '#92400E', lineHeight: 1 }}>
            ${annual_revenue_lost_dollars.toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: '#92400E', marginTop: 6 }}>
            {counts.lost_order_click.toLocaleString()} attempted orders × ${data.avg_ticket_assumption} avg ticket × 12 months. Customers who couldn&apos;t order from you went to other donut shops.
          </div>
        </div>
      )}

      {/* Outreach templates */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1, color: '#6B7280', margin: '0 0 16px 0' }}>
          PITCH OUTREACH
        </h3>

        <TemplateBlock
          label="SMS template (Telnyx)"
          text={smsText}
          onCopy={() => copy(smsText, 'SMS text')}
        />

        <TemplateBlock
          label={`Email subject — ${emailSubject}`}
          text={emailBody}
          onCopy={() => copy(`Subject: ${emailSubject}\n\n${emailBody}`, 'email')}
          isMultiline
        />

        <TemplateBlock
          label="Claim link (give them the URL)"
          text={claim_url}
          onCopy={() => copy(claim_url, 'claim link')}
          isLink
        />
      </div>

      {/* Sanity footer */}
      <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 24, lineHeight: 1.5 }}>
        All numbers above are real interactions from dd_shop_engagement over the last 30 days,
        filtered to events that occurred while this shop was unclaimed. The dollar estimate uses a
        ${data.avg_ticket_assumption} avg-ticket assumption — every digit is traceable to a row in
        the database.
      </p>
    </div>
  )
}

function JourneyRow({ label, count, highlight }: { label: string; count: number; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F9FAFB' }}>
      <span style={{ fontSize: 14, color: highlight ? '#1A1A2E' : '#4B5563', fontWeight: highlight ? 700 : 500 }}>{label}</span>
      <span style={{ fontSize: 16, color: highlight ? '#6366F1' : '#1A1A2E', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
        {count.toLocaleString()}
      </span>
    </div>
  )
}

function TemplateBlock({ label, text, onCopy, isMultiline, isLink }: {
  label: string
  text: string
  onCopy: () => void
  isMultiline?: boolean
  isLink?: boolean
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{
          flex: 1,
          background: '#F9FAFB',
          border: '1px solid #E5E7EB',
          borderRadius: 8,
          padding: 12,
          fontSize: 13,
          color: '#1A1A2E',
          fontFamily: isLink ? 'ui-monospace, SFMono-Regular, monospace' : 'inherit',
          whiteSpace: isMultiline ? 'pre-wrap' : 'normal',
          minHeight: isMultiline ? 80 : 'auto',
          lineHeight: 1.5,
        }}>
          {text}
        </div>
        <button
          onClick={onCopy}
          style={{ alignSelf: 'flex-start', background: '#6366F1', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 700, flexShrink: 0 }}
        >
          Copy
        </button>
      </div>
    </div>
  )
}

// SMS — short and personal. Telnyx 160-char single-segment if possible
// (this template runs ~145 chars depending on numbers).
function buildSmsText(data: PitchData | null): string {
  if (!data) return ''
  const { shop, counts, annual_revenue_lost_dollars, claim_url } = data
  if (counts.lost_order_click > 0) {
    return `Hi from DonutDash — ${shop.name} got ${counts.lost_order_click} attempted orders this month from customers who couldn't check out. ~$${annual_revenue_lost_dollars.toLocaleString()}/yr in lost sales. Claim free: ${claim_url}`
  }
  return `Hi from DonutDash — ${shop.name} got ${data.total_engagement.toLocaleString()} customer interactions this month. Activate ordering free: ${claim_url}`
}

function buildEmailSubject(data: PitchData | null): string {
  if (!data) return ''
  const { shop, annual_revenue_lost_dollars } = data
  if (annual_revenue_lost_dollars > 0) {
    return `${shop.name}: you're losing ~$${annual_revenue_lost_dollars.toLocaleString()}/yr to competitors`
  }
  return `${shop.name}: customers are searching for you on DonutDash`
}

function buildEmailBody(data: PitchData | null): string {
  if (!data) return ''
  const { shop, counts, total_engagement, unique_visitors, annual_revenue_lost_dollars, claim_url, shop_url } = data

  return [
    `Hi — this is the team at DonutDash (donutdash.app).`,
    ``,
    `Over the last 30 days, your shop (${shop.name}) has been getting real traffic on our platform — even though you haven't activated it yet:`,
    ``,
    `  • Appeared in ${counts.search_impression.toLocaleString()} donut searches in your area`,
    `  • ${unique_visitors.toLocaleString()} unique people viewed your shop page`,
    `  • ${counts.menu_item_view.toLocaleString()} opened your menu`,
    `  • ${counts.lost_order_click.toLocaleString()} tried to place an order — they ordered from competitors instead`,
    ``,
    annual_revenue_lost_dollars > 0
      ? `At a $${data.avg_ticket_assumption} average ticket, that's roughly $${annual_revenue_lost_dollars.toLocaleString()}/year you're leaving on the table.`
      : `As more customers find your listing, we'd love to help you capture those orders.`,
    ``,
    `Activating takes about 30 seconds. There's no monthly fee — we only earn when you do.`,
    ``,
    `Your page: ${shop_url}`,
    `Claim your shop: ${claim_url}`,
    ``,
    `Thanks,`,
    `DonutDash team`,
  ].join('\n')
}
