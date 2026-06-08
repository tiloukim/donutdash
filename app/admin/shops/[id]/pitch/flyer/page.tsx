'use client'

// Print-optimized one-page pitch flyer for prospective shop owners.
// Lands at /admin/shops/[id]/pitch/flyer — opened in a new tab from the
// admin pitch page via the "Download PDF" button. Auto-fires
// window.print() on mount so the cashier just picks "Save as PDF" in
// the browser dialog and either hands a printout to the shop owner or
// emails the PDF.
//
// Sized to US Letter (8.5x11 in) at 72dpi via the @media print CSS so
// it reliably prints on one page across Chrome / Safari / Edge.
//
// No layout chrome — no admin sidebar, no nav, just the flyer. Same
// engagement numbers as the screen pitch page, restated for paper.

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

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
}

export default function PitchFlyerPage() {
  const params = useParams()
  const shopId = params.id as string
  const [data, setData] = useState<PitchData | null>(null)

  useEffect(() => {
    if (!shopId) return
    fetch(`/api/admin/shops/${shopId}/pitch`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null))
  }, [shopId])

  // Auto-open the print dialog as soon as the flyer has rendered with
  // real numbers. Delay 500ms so the layout's settled and the user sees
  // the preview behind the dialog (in case they cancel and need to
  // tweak something before saving).
  useEffect(() => {
    if (!data) return
    const t = setTimeout(() => window.print(), 500)
    return () => clearTimeout(t)
  }, [data])

  if (!data) {
    return (
      <div style={{ padding: 32, fontFamily: 'sans-serif', color: '#666' }}>
        Loading flyer…
      </div>
    )
  }

  const { shop, counts, total_engagement, unique_visitors, annual_revenue_lost_dollars, claim_url } = data
  const showDollars = annual_revenue_lost_dollars > 0

  return (
    <>
      <style>{`
        @page {
          size: letter portrait;
          margin: 0.5in;
        }
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
        }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #F8F9FA; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1A1A2E; }
      `}</style>

      {/* Print controls — hidden when actually printing. */}
      <div className="no-print" style={{ position: 'fixed', top: 12, right: 12, zIndex: 100, display: 'flex', gap: 8 }}>
        <button
          onClick={() => window.print()}
          style={{ background: '#FF8C00', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
        >
          🖨️ Print / Save as PDF
        </button>
        <button
          onClick={() => window.close()}
          style={{ background: '#fff', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
        >
          Close
        </button>
      </div>

      <div style={{ maxWidth: '7.5in', margin: '0 auto', padding: 24, background: '#fff', minHeight: '10in' }}>
        {/* Header band */}
        <div style={{ background: 'linear-gradient(135deg, #FF8C00 0%, #FFA940 100%)', borderRadius: 12, padding: '24px 28px', color: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: 1.8, opacity: 0.95 }}>
                CUSTOMERS ARE ALREADY LOOKING FOR
              </p>
              <h1 style={{ margin: '6px 0 4px 0', fontSize: 32, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1 }}>
                {shop.name}
              </h1>
              <p style={{ margin: 0, fontSize: 15, opacity: 0.95 }}>
                {shop.city ?? ''}{shop.city && shop.state ? ', ' : ''}{shop.state ?? ''}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, opacity: 0.9 }}>🍩 DONUTDASH</div>
              <div style={{ fontSize: 10, marginTop: 2, opacity: 0.85 }}>donutdash.app</div>
            </div>
          </div>
        </div>

        {/* Headline metric */}
        <div style={{ textAlign: 'center', padding: '28px 0 16px 0' }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: 1.6, color: '#6B7280' }}>
            IN THE LAST 30 DAYS
          </p>
          <p style={{ margin: '8px 0 4px 0', fontSize: 84, fontWeight: 900, lineHeight: 1, letterSpacing: -2.5, color: '#1A1A2E' }}>
            {total_engagement.toLocaleString()}
          </p>
          <p style={{ margin: 0, fontSize: 15, color: '#4B5563' }}>
            customer interactions with your shop on DonutDash
          </p>
        </div>

        {/* Customer journey table */}
        <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '14px 20px', margin: '12px 0' }}>
          <p style={{ margin: '0 0 10px 0', fontSize: 11, fontWeight: 800, letterSpacing: 1, color: '#6B7280' }}>
            CUSTOMER JOURNEY
          </p>
          <FlyerRow label="Appeared in donut searches" count={counts.search_impression} />
          <FlyerRow label="Viewed your shop page" count={counts.page_view} />
          <FlyerRow label="Opened your menu" count={counts.menu_item_view} />
          <FlyerRow label="Tried to order — went to competitors" count={counts.lost_order_click} highlight />
          <FlyerRow label="Unique people" count={unique_visitors} />
        </div>

        {/* Dollar callout */}
        {showDollars && (
          <div style={{ background: '#FEF3C7', border: '2px solid #FCD34D', borderRadius: 10, padding: 18, margin: '12px 0', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: 1, color: '#92400E' }}>
              ANNUAL REVENUE LOST TO COMPETITORS
            </p>
            <p style={{ margin: '4px 0', fontSize: 48, fontWeight: 900, color: '#92400E', letterSpacing: -1, lineHeight: 1 }}>
              ${annual_revenue_lost_dollars.toLocaleString()}
            </p>
            <p style={{ margin: 0, fontSize: 11, color: '#92400E' }}>
              {counts.lost_order_click.toLocaleString()} attempted orders × ${data.avg_ticket_assumption} avg ticket × 12 months
            </p>
          </div>
        )}

        {/* CTA strip */}
        <div style={{ background: '#1A1A2E', borderRadius: 10, padding: '20px 24px', color: '#fff', margin: '16px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                Activate ordering for free.
              </p>
              <p style={{ margin: '2px 0 0 0', fontSize: 12, opacity: 0.85 }}>
                No monthly fees. We only earn when you do. Free POS app included.
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ background: '#FF8C00', borderRadius: 8, padding: '10px 18px', display: 'inline-block', fontWeight: 800, fontSize: 14 }}>
                Visit the link below
              </div>
            </div>
          </div>
        </div>

        {/* URL block — primary action, easy to type */}
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <p style={{ margin: 0, fontSize: 11, color: '#6B7280', fontWeight: 700, letterSpacing: 1 }}>
            CLAIM YOUR SHOP AT
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: 22, fontWeight: 800, color: '#FF8C00', letterSpacing: -0.2, fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
            {claim_url.replace(/^https?:\/\//, '')}
          </p>
        </div>

        {/* Defensibility footer */}
        <hr style={{ border: 0, borderTop: '1px solid #E5E7EB', margin: '20px 0 10px 0' }} />
        <p style={{ fontSize: 9, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
          All numbers above are real anonymous interactions tracked over the last 30 days on donutdash.app —
          sourced from internal engagement logs. Dollar estimate uses a ${data.avg_ticket_assumption} average
          donut-shop ticket. Questions? hello@donutdash.app
        </p>
      </div>
    </>
  )
}

function FlyerRow({ label, count, highlight }: { label: string; count: number; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #F3F4F6', fontSize: 13 }}>
      <span style={{ color: highlight ? '#1A1A2E' : '#4B5563', fontWeight: highlight ? 700 : 500 }}>
        {label}
      </span>
      <span style={{ color: highlight ? '#FF8C00' : '#1A1A2E', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
        {count.toLocaleString()}
      </span>
    </div>
  )
}
