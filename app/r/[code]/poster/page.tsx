import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://donutdash.app'

async function lookupReferrer(rawCode: string): Promise<{ name: string; isDriver: boolean } | null> {
  const code = rawCode.trim().toUpperCase()
  if (!code) return null
  const svc = createServiceClient()
  if (code.startsWith('DRV')) {
    const { data } = await svc.from('dd_users').select('name').eq('referral_code', code).maybeSingle()
    if (!data) return null
    return { name: data.name || 'A DonutDash driver', isDriver: true }
  }
  if (code.startsWith('SHOP')) {
    const { data } = await svc.from('dd_shops').select('name').eq('referral_code', code).maybeSingle()
    if (!data) return null
    return { name: data.name || 'A DonutDash shop', isDriver: false }
  }
  return null
}

export default async function ReferralPoster({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ audience?: string }>
}) {
  const { code: rawCode } = await params
  const { audience } = await searchParams
  const code = rawCode.toUpperCase()
  const info = await lookupReferrer(code)
  if (!info) notFound()

  const url = `${BASE_URL}/r/${encodeURIComponent(code)}`
  const aud: 'drivers' | 'shops' | 'both' =
    audience === 'drivers' || audience === 'shops' ? audience : 'both'
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=520x520&margin=4&qzone=1&data=${encodeURIComponent(url)}`

  const headline =
    aud === 'drivers' ? 'Drive with DonutDash'
    : aud === 'shops' ? 'List Your Shop on DonutDash'
    : 'Join DonutDash'

  const taglines =
    aud === 'drivers' ? ['Earn $50 to start', 'Flexible hours', 'Cash out weekly']
    : aud === 'shops' ? ['Earn $100 to start', 'Reach more customers', 'Free delivery network']
    : ['Drive and earn', 'Or list your shop', "We'll handle the rest"]

  return (
    <>
      <style>{`
        @page { size: letter; margin: 0; }
        html, body { margin: 0; padding: 0; background: #fff; }
        .dd-footer { display: none !important; }
        .poster-print-toolbar { position: fixed; top: 12px; right: 12px; z-index: 100; display: flex; gap: 8px; }
        .poster-print-toolbar a, .poster-print-toolbar button {
          padding: 10px 16px; border-radius: 8px; font-weight: 700; font-size: 14px; cursor: pointer;
          border: 1px solid #ddd; background: #fff; color: #333; text-decoration: none;
          display: inline-block;
        }
        .poster-print-toolbar .primary { background: #FF8C00; color: #fff; border-color: #FF8C00; }
        @media print {
          .poster-print-toolbar { display: none !important; }
        }
        .poster-page {
          width: 100vw; min-height: 100vh;
          display: flex; align-items: center; justify-content: center;
          padding: 32px;
          box-sizing: border-box;
          background: linear-gradient(135deg, #FFF0F5 0%, #FFFAF0 100%);
        }
        .poster {
          width: 100%; max-width: 720px;
          background: #fff;
          border-radius: 28px;
          padding: 48px 40px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.08);
          text-align: center;
          border: 4px solid #FF8C00;
          box-sizing: border-box;
        }
        @media print {
          .poster-page { padding: 0; background: #fff !important; min-height: auto; }
          .poster {
            box-shadow: none;
            border-radius: 0;
            border: none;
            max-width: none;
            width: 100%;
            padding: 24px;
          }
        }
      `}</style>

      {/*
        React blocks javascript: URLs in JSX as a security measure, so we inject
        the toolbar via dangerouslySetInnerHTML — the browser handles onclick
        as a plain HTML attribute, no React hydration required.
      */}
      <div
        className="poster-print-toolbar"
        dangerouslySetInnerHTML={{
          __html: `<button class="primary" onclick="window.print()" type="button">🖨 Print Poster</button><a href="${url}">Back</a>`,
        }}
      />

      <div className="poster-page">
        <div className="poster">
          <div style={{ fontSize: 64, marginBottom: 8 }}>🍩</div>
          <div style={{ fontSize: 14, color: '#FF8C00', fontWeight: 800, letterSpacing: 4, marginBottom: 4 }}>
            DONUTDASH
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 900, margin: '4px 0 8px 0', color: '#1A1A2E', lineHeight: 1.05 }}>
            {headline}
          </h1>
          <div style={{ fontSize: 16, color: '#888', marginBottom: 24 }}>
            Invited by <strong style={{ color: '#1A1A2E' }}>{info.name}</strong>
          </div>

          <div style={{ display: 'inline-block', padding: 16, background: '#fff', border: '2px solid #FFE8D6', borderRadius: 18 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrUrl}
              alt={`Scan to join via ${code}`}
              width={420}
              height={420}
              style={{ display: 'block', width: 420, height: 420 }}
            />
          </div>

          <div style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', marginTop: 22 }}>
            Scan to sign up
          </div>
          <div style={{ fontSize: 14, color: '#888', marginTop: 6 }}>
            or visit <strong style={{ color: '#FF8C00' }}>{url.replace(/^https?:\/\//, '')}</strong>
          </div>

          <div style={{
            background: '#FFF8F0', border: '2px dashed #FFD9A8', borderRadius: 14,
            padding: '16px 20px', marginTop: 24, display: 'inline-flex', gap: 16, alignItems: 'baseline',
          }}>
            <span style={{ fontSize: 13, color: '#92400E', fontWeight: 700, letterSpacing: 1 }}>REFERRAL CODE</span>
            <span style={{ fontSize: 32, fontWeight: 900, color: '#FF8C00', letterSpacing: 4 }}>{code}</span>
          </div>

          <div style={{
            display: 'flex', justifyContent: 'center', gap: 24, marginTop: 28,
            flexWrap: 'wrap',
          }}>
            {taglines.map(t => (
              <div key={t} style={{ fontSize: 15, color: '#1A1A2E', fontWeight: 600 }}>
                ✓ {t}
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 32, paddingTop: 20, borderTop: '1px solid #FFE8D6',
            fontSize: 12, color: '#aaa',
          }}>
            DonutDash — local donut delivery, East Texas.
          </div>
        </div>
      </div>
    </>
  )
}
