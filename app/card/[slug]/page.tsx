import { notFound } from 'next/navigation'
import { getTeamMember, formatPhone } from '@/lib/team'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const member = await getTeamMember(slug)
  if (!member) return { title: 'Not Found' }
  return {
    title: `${member.name} — DonutDash`,
    description: `${member.title} at DonutDash. Fresh donuts delivered fast.`,
  }
}

export default async function TeamCard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const m = await getTeamMember(slug)
  if (!m) notFound()

  const phoneFormatted = formatPhone(m.phone)

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
        {/* Header — full-color logo on a soft cream/pink wash. The footer logo
            is a transparent PNG with the running-donut mascot + wordmark + tagline
            all baked in, so we don't need any extra text here. */}
        <div style={{
          background: 'linear-gradient(135deg, #3A332A 0%, #8B7042 40%, #D4AF37 100%)',
          padding: '24px 24px 56px', textAlign: 'center',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span style={{ display: 'inline-flex', alignItems: 'flex-start', justifyContent: 'center' }}><img src="/DonutDashfooterlogo.png" alt="DonutDash" style={{ height: 64, width: 'auto', maxWidth: '90%' }} /><sup style={{ fontSize: 11, fontWeight: 700, marginLeft: 1 }}>™</sup></span>
        </div>

        {/* Profile — avatar straddles the header/white boundary cleanly. */}
        <div style={{ padding: '0 28px 0', textAlign: 'center', marginTop: -56 }}>
          <div style={{
            width: 112, height: 112, borderRadius: '50%', margin: '0 auto 14px',
            background: m.photo_url
              ? `url(${m.photo_url}) center/cover`
              : 'linear-gradient(135deg, #FF1493 0%, #FF8C00 100%)',
            border: '5px solid #fff',
            boxShadow: '0 6px 20px rgba(0,0,0,0.14)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 40, fontWeight: 800,
          }}>
            {!m.photo_url && m.name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>{m.name}</h1>
          <p style={{ fontSize: 14, color: '#FF1493', fontWeight: 600, marginBottom: 4 }}>{m.title}</p>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>{m.location}</p>
        </div>

        {/* Contact */}
        <div style={{ padding: '0 28px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a href={`tel:${m.phone}`} style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
            background: '#FFF0F5', borderRadius: 14, textDecoration: 'none',
          }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: '#FF1493', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>&#128222;</div>
            <div>
              <div style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>Phone</div>
              <div style={{ fontSize: 15, color: '#1A1A2E', fontWeight: 600 }}>{phoneFormatted}</div>
            </div>
          </a>

          <a href={`mailto:${m.email}`} style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
            background: '#FFF0F5', borderRadius: 14, textDecoration: 'none',
          }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: '#FF8C00', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>&#9993;</div>
            <div>
              <div style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>Email</div>
              <div style={{ fontSize: 15, color: '#1A1A2E', fontWeight: 600 }}>{m.email}</div>
            </div>
          </a>

          <a href="https://donutdash.app" target="_blank" rel="noopener noreferrer" style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
            background: '#FFF0F5', borderRadius: 14, textDecoration: 'none',
          }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>&#127760;</div>
            <div>
              <div style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>Website</div>
              <div style={{ fontSize: 15, color: '#1A1A2E', fontWeight: 600 }}>donutdash.app</div>
            </div>
          </a>

          <a href={`sms:${m.phone}?body=Hi%20${encodeURIComponent(m.name.split(' ')[0])}%2C%20I%27m%20interested%20in%20DonutDash!`} style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
            background: '#FFF0F5', borderRadius: 14, textDecoration: 'none',
          }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>&#128172;</div>
            <div>
              <div style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>Text Message</div>
              <div style={{ fontSize: 15, color: '#1A1A2E', fontWeight: 600 }}>Send a text</div>
            </div>
          </a>
        </div>

        <div style={{ height: 1, background: '#f0f0f0', margin: '0 28px' }} />

        <div style={{ padding: '20px 28px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>What We Do</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['Donut Delivery', 'Shop Partnerships', 'Driver Network', 'Online Ordering', 'Catering'].map(tag => (
              <span key={tag} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#FFF0F5', color: '#FF1493' }}>{tag}</span>
            ))}
          </div>
        </div>

        <div style={{ padding: '0 28px 24px' }}>
          <a href={`/api/vcard?slug=${m.slug}`} style={{
            display: 'block', width: '100%', padding: '14px',
            background: 'linear-gradient(135deg, #FF1493, #FF8C00)', color: '#fff',
            borderRadius: 14, fontSize: 16, fontWeight: 700, textAlign: 'center',
            textDecoration: 'none', boxSizing: 'border-box',
          }}>
            Save Contact
          </a>
        </div>

        {/* QR Code */}
        <div style={{ padding: '20px 28px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Scan to save</div>
          <img src={`/api/qr?slug=${m.slug}`} alt="QR Code" style={{ width: 160, height: 160, borderRadius: 12, display: 'block', margin: '0 auto' }} />
        </div>

        <div style={{ padding: '16px 28px', background: '#FAFAFA', textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>DonutDash &mdash; Delicious Donuts Delivered Fast</p>
        </div>
      </div>
    </div>
  )
}
