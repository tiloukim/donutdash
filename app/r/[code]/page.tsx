import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface ReferrerInfo {
  name: string
  ownerLabel: string // 'driver' | 'shop'
  isDriverCode: boolean
  isShopCode: boolean
}

async function lookupReferrer(rawCode: string): Promise<ReferrerInfo | null> {
  const code = rawCode.trim().toUpperCase()
  if (!code) return null
  const svc = createServiceClient()

  // Driver/admin codes start with DRV (auto-generated in /api/driver/referral)
  if (code.startsWith('DRV')) {
    const { data } = await svc.from('dd_users')
      .select('name')
      .eq('referral_code', code)
      .maybeSingle()
    if (!data) return null
    return { name: data.name || 'A DonutDash driver', ownerLabel: 'driver', isDriverCode: true, isShopCode: false }
  }

  // Shop codes start with SHOP (auto-generated in /api/shop/referral)
  if (code.startsWith('SHOP')) {
    const { data } = await svc.from('dd_shops')
      .select('name')
      .eq('referral_code', code)
      .maybeSingle()
    if (!data) return null
    return { name: data.name || 'A DonutDash shop', ownerLabel: 'shop', isDriverCode: false, isShopCode: true }
  }

  return null
}

export default async function ReferralLanding({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params
  const code = rawCode.toUpperCase()
  const info = await lookupReferrer(code)
  if (!info) notFound()

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #FFF0F5 0%, #FFF5EE 50%, #FFFAF0 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      {/* Persist ref on the device the moment they land — survives signup → email confirm → callback */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try { localStorage.setItem('dd_ref', ${JSON.stringify(code)}); } catch(e) {}`,
        }}
      />

      <div style={{
        background: '#fff', borderRadius: 24, padding: '36px 28px', maxWidth: 440, width: '100%',
        boxShadow: '0 20px 60px rgba(255,140,0,0.15)', textAlign: 'center',
      }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>🍩</div>
        <div style={{ fontSize: 13, color: '#FF8C00', fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
          YOU&apos;VE BEEN INVITED
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 8px 0', color: '#1A1A2E', lineHeight: 1.2 }}>
          {info.name} invited you to DonutDash
        </h1>
        <p style={{ fontSize: 15, color: '#666', margin: '0 0 24px 0', lineHeight: 1.5 }}>
          {info.isDriverCode
            ? 'Earn money delivering donuts in East Texas, or list your shop on DonutDash. Both of you get rewarded.'
            : 'Join the DonutDash community as a driver or list your shop. Both of you get rewarded.'}
        </p>

        <div style={{
          background: '#FFF8F0', borderRadius: 12, padding: '14px 18px', marginBottom: 24,
          border: '1px dashed #FFD9A8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 12, color: '#888' }}>Referral code</span>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: 2, color: '#FF8C00' }}>{code}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <Link href={`/driver?ref=${encodeURIComponent(code)}`} style={{
            display: 'block', padding: '16px 20px', borderRadius: 12, background: '#FF8C00', color: '#fff',
            fontSize: 16, fontWeight: 800, textDecoration: 'none', boxShadow: '0 8px 20px rgba(255,140,0,0.3)',
          }}>
            🚗 Become a Driver — Earn $50
          </Link>
          <Link href={`/shop?ref=${encodeURIComponent(code)}`} style={{
            display: 'block', padding: '16px 20px', borderRadius: 12, background: '#fff', color: '#FF1493',
            fontSize: 16, fontWeight: 800, textDecoration: 'none', border: '2px solid #FF1493',
          }}>
            🏪 List Your Shop — Earn $100
          </Link>
        </div>

        <p style={{ fontSize: 12, color: '#aaa', margin: 0, lineHeight: 1.5 }}>
          The referral code will be applied automatically after you sign up.
        </p>
      </div>
    </div>
  )
}
