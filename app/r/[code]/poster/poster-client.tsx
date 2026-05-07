'use client'

interface Props {
  code: string
  url: string
  referrerName: string
  audience: 'drivers' | 'shops' | 'both'
}

export default function PosterClient({ code, url, referrerName, audience }: Props) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=520x520&margin=4&qzone=1&data=${encodeURIComponent(url)}`

  const headline =
    audience === 'drivers' ? 'Drive with DonutDash'
    : audience === 'shops' ? 'List Your Shop on DonutDash'
    : 'Join DonutDash'

  const taglines =
    audience === 'drivers' ? ['Earn $50 to start', 'Flexible hours', 'Cash out weekly']
    : audience === 'shops' ? ['Earn $100 to start', 'Reach more customers', 'Free delivery network']
    : ['Drive and earn', 'Or list your shop', "We'll handle the rest"]

  return (
    <>
      <style>{`
        @page { size: letter; margin: 0; }
        html, body { margin: 0; padding: 0; background: #fff; }
        .poster-print-toolbar { position: fixed; top: 12px; right: 12px; z-index: 100; display: flex; gap: 8px; }
        .poster-print-toolbar button {
          padding: 10px 16px; border-radius: 8px; font-weight: 700; font-size: 14px; cursor: pointer;
          border: 1px solid #ddd; background: #fff;
        }
        .poster-print-toolbar .primary { background: #FF8C00; color: #fff; border-color: #FF8C00; }
        @media print {
          .poster-print-toolbar { display: none !important; }
        }
        /* Letter & A4 paper aspect; renders ~8.5x11 at 96dpi = 816x1056 */
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

      <div className="poster-print-toolbar">
        <button onClick={() => window.print()} className="primary">🖨 Print Poster</button>
        <button onClick={() => history.back()}>Back</button>
      </div>

      <div className="poster-page">
        <div className="poster">
          {/* Header */}
          <div style={{ fontSize: 64, marginBottom: 8 }}>🍩</div>
          <div style={{ fontSize: 14, color: '#FF8C00', fontWeight: 800, letterSpacing: 4, marginBottom: 4 }}>
            DONUTDASH
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 900, margin: '4px 0 8px 0', color: '#1A1A2E', lineHeight: 1.05 }}>
            {headline}
          </h1>
          <div style={{ fontSize: 16, color: '#888', marginBottom: 24 }}>
            Invited by <strong style={{ color: '#1A1A2E' }}>{referrerName}</strong>
          </div>

          {/* QR */}
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

          {/* Code */}
          <div style={{
            background: '#FFF8F0', border: '2px dashed #FFD9A8', borderRadius: 14,
            padding: '16px 20px', marginTop: 24, display: 'inline-flex', gap: 16, alignItems: 'baseline',
          }}>
            <span style={{ fontSize: 13, color: '#92400E', fontWeight: 700, letterSpacing: 1 }}>REFERRAL CODE</span>
            <span style={{ fontSize: 32, fontWeight: 900, color: '#FF8C00', letterSpacing: 4 }}>{code}</span>
          </div>

          {/* Taglines */}
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

          {/* Footer */}
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
