'use client'

// Public personalized landing page for prospective shop owners.
// This is the SHORT URL we share via SMS / printed flyer / email —
// donutdash.app/claim/{slug} — so a busy shop owner reading a text
// while ringing up a customer can tap once and see exactly why they
// should care, then hit the existing /shops/claim/{slug} flow to
// actually activate.
//
// Mobile-first single-column layout. Big numbers, short copy, one
// primary CTA. Every metric on screen ties back to a real row in
// dd_shop_engagement — same data, same shape, same defensibility as
// the admin pitch screen.

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface PitchData {
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

export default function PublicClaimLandingPage() {
  const params = useParams()
  const slug = params.slug as string
  const [data, setData] = useState<PitchData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    fetch(`/api/pitch/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (res.status === 404) {
          setNotFound(true)
          return null
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<PitchData>
      })
      .then((d) => d && setData(d))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <main style={pageBg}>
        <p style={{ color: '#888' }}>Loading…</p>
      </main>
    )
  }

  if (notFound || !data) {
    return (
      <main style={pageBg}>
        <div style={{ maxWidth: 480, textAlign: 'center', padding: 24 }}>
          <h1 style={{ fontSize: 24, color: '#1A1A2E', marginBottom: 8 }}>Shop not found</h1>
          <p style={{ color: '#6B7280', fontSize: 14 }}>
            The link you followed might be old. Browse all shops at{' '}
            <Link href="/shops" style={{ color: '#FF8C00' }}>donutdash.app/shops</Link>.
          </p>
        </div>
      </main>
    )
  }

  const { shop, counts, total_engagement, unique_visitors, annual_revenue_lost_dollars, claim_url, shop_url } = data

  return (
    <main style={pageBg}>
      <div style={{ width: '100%', maxWidth: 520 }}>
        {/* Brand bar */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Link href="/" style={{ color: '#FF8C00', fontSize: 18, fontWeight: 900, textDecoration: 'none', letterSpacing: -0.5 }}>
            🍩 DonutDash™
          </Link>
        </div>

        {/* Already-claimed soft state — saved links shouldn't dead-end */}
        {shop.is_claimed && (
          <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 12, padding: 16, marginBottom: 16, textAlign: 'center' }}>
            <p style={{ margin: 0, color: '#065F46', fontWeight: 700, fontSize: 14 }}>
              ✓ {shop.name} is already active on DonutDash
            </p>
            <Link href={shop_url} style={{ color: '#065F46', fontSize: 13, textDecoration: 'underline' }}>
              View the shop →
            </Link>
          </div>
        )}

        {/* Pitch card */}
        <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ background: 'linear-gradient(135deg, #FF8C00 0%, #FFA940 100%)', padding: '28px 24px', color: '#fff' }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: 1.5, opacity: 0.95 }}>
              CUSTOMERS ARE LOOKING FOR
            </p>
            <h1 style={{ margin: '6px 0 4px 0', fontSize: 28, fontWeight: 900, lineHeight: 1.1, letterSpacing: -0.5 }}>
              {shop.name}
            </h1>
            <p style={{ margin: 0, fontSize: 15, opacity: 0.95 }}>
              {shop.city ?? ''}{shop.city && shop.state ? ', ' : ''}{shop.state ?? ''}
            </p>
          </div>

          {/* Body */}
          <div style={{ padding: '24px' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#6B7280', letterSpacing: 0.8, margin: '0 0 8px 0' }}>
              IN THE LAST 30 DAYS
            </p>

            <div style={{ fontSize: 56, fontWeight: 900, color: '#1A1A2E', lineHeight: 1, letterSpacing: -2, margin: '0 0 4px 0' }}>
              {total_engagement.toLocaleString()}
            </div>
            <p style={{ margin: 0, fontSize: 14, color: '#4B5563' }}>
              customer interactions with your shop on DonutDash
            </p>

            <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #F3F4F6' }}>
              <JourneyRow emoji="🔍" label="appeared in donut searches" count={counts.search_impression} />
              <JourneyRow emoji="👀" label="viewed your shop page" count={counts.page_view} />
              <JourneyRow emoji="📖" label="opened your menu" count={counts.menu_item_view} />
              <JourneyRow emoji="🛒" label="tried to order from you" count={counts.lost_order_click} highlight />
              <JourneyRow emoji="🧍" label="unique people" count={unique_visitors} />
            </div>

            {/* Dollar callout */}
            {annual_revenue_lost_dollars > 0 && (
              <div style={{ marginTop: 20, padding: 18, background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 12 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#92400E', letterSpacing: 1 }}>
                  ANNUAL REVENUE LOST
                </p>
                <p style={{ margin: '4px 0 4px 0', fontSize: 36, fontWeight: 900, color: '#92400E', letterSpacing: -1 }}>
                  ${annual_revenue_lost_dollars.toLocaleString()}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: '#92400E' }}>
                  {counts.lost_order_click.toLocaleString()} attempted orders × ${data.avg_ticket_assumption} avg ticket × 12 months. They ordered from competitors instead.
                </p>
              </div>
            )}

            {/* CTA block */}
            {!shop.is_claimed && (
              <div style={{ marginTop: 24 }}>
                <p style={{ fontSize: 17, fontWeight: 700, color: '#1A1A2E', margin: '0 0 6px 0', lineHeight: 1.3 }}>
                  Activate ordering for free.
                </p>
                <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 16px 0' }}>
                  No monthly fees. We only earn when you do.
                </p>

                <Link
                  href={claim_url}
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    background: '#FF8C00',
                    color: '#fff',
                    padding: '16px 20px',
                    borderRadius: 10,
                    fontWeight: 800,
                    fontSize: 17,
                    textDecoration: 'none',
                    letterSpacing: 0.2,
                  }}
                >
                  Claim Your Shop →
                </Link>

                <p style={{ marginTop: 12, fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>
                  ~30 seconds. Free POS app included.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer: defensibility note */}
        <p style={{ marginTop: 16, fontSize: 11, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.5, padding: '0 16px' }}>
          All numbers above are real anonymous interactions tracked over the last 30 days on
          donutdash.app. The dollar estimate uses a ${data.avg_ticket_assumption} avg-ticket
          assumption — common for donut-shop transactions. Questions? Email{' '}
          <a href="mailto:hello@donutdash.app" style={{ color: '#FF8C00' }}>hello@donutdash.app</a>.
        </p>
      </div>
    </main>
  )
}

function JourneyRow({ emoji, label, count, highlight }: { emoji: string; label: string; count: number; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
      <span style={{ fontSize: 16 }}>{emoji}</span>
      <span style={{ flex: 1, fontSize: 14, color: highlight ? '#1A1A2E' : '#4B5563', fontWeight: highlight ? 700 : 500 }}>
        <span style={{ fontWeight: 800, color: '#1A1A2E', marginRight: 4 }}>{count.toLocaleString()}</span>
        {label}
      </span>
    </div>
  )
}

const pageBg: React.CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(180deg, #FFF8F0 0%, #FFFFFF 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}
