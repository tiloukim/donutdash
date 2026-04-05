import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'DonutDash — Digital Business Card',
  description: 'Fresh donuts delivered fast. Partner with DonutDash today.',
}

export default function BusinessCard() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #FFF0F5 0%, #FFFFFF 50%, #FFFAF0 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: 24, overflow: 'hidden',
        maxWidth: 400, width: '100%',
        boxShadow: '0 12px 48px rgba(255, 20, 147, 0.12), 0 4px 16px rgba(0,0,0,0.06)',
      }}>
        {/* Header Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #FF1493 0%, #FF69B4 50%, #FF8C00 100%)',
          padding: '32px 24px 28px', textAlign: 'center', position: 'relative',
        }}>
          <img src="/logo.png" alt="DonutDash" style={{ height: 56, width: 'auto', filter: 'brightness(10)', marginBottom: 8 }} />
          <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 500, letterSpacing: 1 }}>
            FRESH DONUTS DELIVERED FAST
          </div>
        </div>

        {/* Profile */}
        <div style={{ padding: '24px 28px 0', textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>Tony Kim</h1>
          <p style={{ fontSize: 14, color: '#FF1493', fontWeight: 600, marginBottom: 4 }}>Founder</p>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>Tyler, Texas</p>
        </div>

        {/* Contact Buttons */}
        <div style={{ padding: '0 28px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a href="tel:9033455599" style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
            background: '#FFF0F5', borderRadius: 14, textDecoration: 'none', transition: 'background 0.2s',
          }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: '#FF1493', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
              &#128222;
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>Phone</div>
              <div style={{ fontSize: 15, color: '#1A1A2E', fontWeight: 600 }}>(903) 345-5599</div>
            </div>
          </a>

          <a href="mailto:Donutdash903@gmail.com" style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
            background: '#FFF0F5', borderRadius: 14, textDecoration: 'none',
          }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: '#FF8C00', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
              &#9993;
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>Email</div>
              <div style={{ fontSize: 15, color: '#1A1A2E', fontWeight: 600 }}>Donutdash903@gmail.com</div>
            </div>
          </a>

          <a href="https://donutdash.app" target="_blank" rel="noopener noreferrer" style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
            background: '#FFF0F5', borderRadius: 14, textDecoration: 'none',
          }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
              &#127760;
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>Website</div>
              <div style={{ fontSize: 15, color: '#1A1A2E', fontWeight: 600 }}>donutdash.app</div>
            </div>
          </a>

          <a href="sms:9033455599?body=Hi%20Tony%2C%20I%27m%20interested%20in%20DonutDash!" style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
            background: '#FFF0F5', borderRadius: 14, textDecoration: 'none',
          }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
              &#128172;
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>Text Message</div>
              <div style={{ fontSize: 15, color: '#1A1A2E', fontWeight: 600 }}>Send a text</div>
            </div>
          </a>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: '#f0f0f0', margin: '0 28px' }} />

        {/* Services */}
        <div style={{ padding: '20px 28px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>What We Do</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['Donut Delivery', 'Shop Partnerships', 'Driver Network', 'Online Ordering', 'Catering'].map(tag => (
              <span key={tag} style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: '#FFF0F5', color: '#FF1493',
              }}>{tag}</span>
            ))}
          </div>
        </div>

        {/* Save Contact */}
        <div style={{ padding: '0 28px 24px' }}>
          <a
            href="/api/vcard"
            style={{
              display: 'block', width: '100%', padding: '14px',
              background: 'linear-gradient(135deg, #FF1493, #FF8C00)', color: '#fff',
              borderRadius: 14, fontSize: 16, fontWeight: 700, textAlign: 'center',
              textDecoration: 'none', boxSizing: 'border-box',
            }}
          >
            Save Contact
          </a>
        </div>

        {/* QR Code */}
        <div style={{ padding: '20px 28px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Scan to save</div>
          <img src="/api/qr?slug=tilou" alt="QR Code" style={{ width: 160, height: 160, borderRadius: 12 }} />
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 28px', background: '#FAFAFA', textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>
            DonutDash &mdash; Delicious Donuts Delivered Fast
          </p>
        </div>
      </div>
    </div>
  )
}
