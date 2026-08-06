'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import RoleAuthForm from '@/components/RoleAuthForm'
import PendingReferralApplier from '@/components/PendingReferralApplier'
import { subscribeToPush } from '@/lib/push-notifications'

const NAV_ITEMS = [
  { href: '/driver', label: 'Home', icon: '📍' },
  { href: '/driver/active', label: 'Active', icon: '🚗' },
  { href: '/driver/earnings', label: 'Earnings', icon: '💵' },
  { href: '/driver/referral', label: 'Refer & Earn', icon: '💰' },
  { href: '/driver/documents', label: 'Documents', icon: '📄' },
  { href: '/driver/settings', label: 'Settings', icon: '⚙️' },
]

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, role, signOut } = useAuth()
  const pathname = usePathname()

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: 18 }}>Loading...</div>

  if (!user || (role !== 'driver' && role !== 'admin')) {
    return (
      <RoleAuthForm
        role="driver"
        roleLabel="Driver"
        accentColor="#FF8C00"
        accentHover="#E67E00"
        bgGradient="linear-gradient(135deg, #FFFAF0 0%, #FFFFFF 50%, #FFF5E6 100%)"
        icon="🚗"
        tagline="Sign in to start delivering"
        redirectTo="/driver"
      />
    )
  }

  return (
    <>
      <head><link rel="manifest" href="/manifest-driver.json" /></head>
      <style>{`
        .driver-layout { display: flex; flex-direction: column; min-height: 100vh; min-height: 100dvh; }
        .driver-sidebar { display: none; }
        .driver-main { flex: 1; background: #FFFAF5; padding-bottom: 72px; min-width: 0; }
        .driver-header { background: #fff; border-bottom: 1px solid #FFE8D6; padding: 14px 16px; padding-top: max(14px, env(safe-area-inset-top)); display: flex; justify-content: space-between; align-items: center; gap: 12px; position: sticky; top: 0; z-index: 40; }
        .driver-header h1 { font-size: 18px; font-weight: 700; color: #1A1A2E; margin: 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .driver-header > div:last-child { flex-shrink: 0; }
        .driver-content { padding: 16px; max-width: 100%; overflow-wrap: anywhere; }
        /* Allow flex children with text to shrink instead of forcing the parent wider */
        .driver-content [style*="display: flex"], .driver-content [style*="display:flex"] { min-width: 0; }
        .driver-content [style*="display: flex"] > *, .driver-content [style*="display:flex"] > * { min-width: 0; }
        .driver-content img, .driver-content video { max-width: 100%; height: auto; }
        .driver-bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; background: #2D1B00; display: flex; justify-content: space-around; padding: 6px 0; padding-bottom: max(6px, env(safe-area-inset-bottom)); z-index: 50; border-top: 1px solid rgba(255,255,255,0.1); }
        .driver-bottom-nav a { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 2px; text-decoration: none; font-size: 9px; font-weight: 600; padding: 4px 2px; border-radius: 8px; text-align: center; line-height: 1.1; }
        .driver-bottom-nav a span.icon { font-size: 22px; line-height: 1; }
        .driver-bottom-nav a.active { color: #FF8C00; }
        .driver-bottom-nav a:not(.active) { color: #D4A574; }

        /* Narrow phones (iPhone SE/mini, ≤390 CSS px) — extra-tight spacing */
        @media (max-width: 390px) {
          .driver-content { padding: 12px; }
          .driver-header { padding: 12px; }
          .driver-header h1 { font-size: 16px; }
          .driver-header-name { display: none; }
          .driver-bottom-nav a { font-size: 8px; }
          .driver-bottom-nav a span.icon { font-size: 20px; }
        }

        @media (min-width: 768px) {
          .driver-layout { flex-direction: row; }
          .driver-sidebar { display: flex; flex-direction: column; width: 220px; background: #2D1B00; color: #fff; position: fixed; top: 0; left: 0; bottom: 0; z-index: 50; }
          .driver-main { margin-left: 220px; padding-bottom: 0; }
          .driver-content { padding: 24px; }
          .driver-header { padding: 16px 24px; }
          .driver-header h1 { font-size: 20px; }
          .driver-bottom-nav { display: none; }
          .driver-signout-btn { display: none; }
        }
      `}</style>

      <div className="driver-layout">
        {/* Desktop Sidebar */}
        <aside className="driver-sidebar">
          <div style={{ padding: '24px 20px 16px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="DonutDash" style={{ height: 40, width: 'auto', filter: 'brightness(10)' }} />
            <span style={{ background: '#FF8C00', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, marginTop: 4, display: 'inline-block' }}>DRIVER</span>
          </div>
          <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '0 8px' }}>
            {NAV_ITEMS.map(item => (
              <Link key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8,
                textDecoration: 'none', fontSize: 14, fontWeight: 600,
                color: pathname === item.href ? '#2D1B00' : '#D4A574',
                background: pathname === item.href ? '#FF8C00' : 'transparent',
              }}>
                <span>{item.icon}</span> {item.label}
              </Link>
            ))}
          </nav>
          <div style={{ padding: '16px 8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <Link href="/support/drivers" style={{ display: 'block', padding: '8px 12px', color: '#D4A574', fontSize: 12, textDecoration: 'none' }}>
              📧 Driver Support
            </Link>
            <div style={{ padding: '8px 12px', color: '#D4A574', fontSize: 12 }}>{user.name}</div>
            <button onClick={() => signOut('/driver')} style={{ display: 'block', width: '100%', padding: '8px 12px', color: '#FF8C00', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, textAlign: 'left' }}>Sign Out</button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="driver-main">
          <header className="driver-header">
            <h1>{NAV_ITEMS.find(n => n.href === pathname)?.label || 'Driver'}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="driver-header-name" style={{ fontSize: 13, color: '#666', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</span>
              <button
                onClick={() => signOut('/driver')}
                className="driver-signout-btn"
                style={{ background: 'none', border: '1px solid #FF8C00', color: '#FF8C00', padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                Sign Out
              </button>
            </div>
          </header>
          <div className="driver-content">{children}</div>
        </main>

        {/* Mobile Bottom Tab Bar */}
        <nav className="driver-bottom-nav">
          {NAV_ITEMS.map(item => (
            <Link key={item.href} href={item.href} className={pathname === item.href ? 'active' : ''}>
              <span className="icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    <GlobalDriverAlert />
    <PendingReferralApplier kind="driver" />
    </>
  )
}

// Global delivery offer popup — works on ANY driver page except /driver (which has its own)
function GlobalDriverAlert() {
  const pathname = usePathname()
  const router = useRouter()
  const [offer, setOffer] = useState<any>(null)
  const [responding, setResponding] = useState(false)
  const prevOfferIdRef = useRef<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const vibrateRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const playSound = useCallback(() => {
    try {
      if (!audioRef.current) { audioRef.current = new Audio('/alert.wav'); audioRef.current.loop = true }
      audioRef.current.volume = 1.0; audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {})
    } catch {}
    if (navigator.vibrate) {
      navigator.vibrate([400, 200, 400, 200, 400])
      vibrateRef.current = setInterval(() => navigator.vibrate([400, 200, 400, 200, 400]), 2000)
    }
  }, [])

  const stopSound = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0 }
    if (vibrateRef.current) { clearInterval(vibrateRef.current); vibrateRef.current = null }
    if (navigator.vibrate) navigator.vibrate(0)
  }, [])

  // Poll for offers every 10 seconds
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/driver/offer')
        if (!res.ok) return
        // GET /api/driver/offer returns the offer object directly (top-level
        // `id`), or null when there's none — not a { offer } wrapper.
        const data = await res.json()
        if (data && data.id !== prevOfferIdRef.current) {
          prevOfferIdRef.current = data.id
          setOffer(data)
          playSound()
          if ('Notification' in window && Notification.permission === 'granted') {
            const shopName = data.delivery?.order?.shop?.name || 'New Order'
            const earnings = (data.delivery?.driver_earnings ?? 0).toFixed(2)
            new Notification('New Delivery Offer!', { body: `${shopName} — Earn $${earnings}`, icon: '/logo.png', tag: 'delivery-offer', requireInteraction: true })
          }
        } else if (!data) {
          setOffer(null)
          stopSound()
        }
      } catch {}
    }
    check()
    const i = setInterval(check, 10000)
    return () => { clearInterval(i); stopSound() }
  }, [playSound, stopSound])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission()
  }, [])

  // Register this device for web push so dispatch can reach the driver even
  // when the app is backgrounded or closed — new offers and order-ready
  // alerts arrive as OS notifications, not just in-app while the tab is open.
  useEffect(() => {
    subscribeToPush().catch(() => {})
  }, [])

  const respond = async (action: 'accept' | 'decline') => {
    if (!offer) return
    setResponding(true)
    stopSound()
    const res = await fetch('/api/driver/offer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offer_id: offer.id, action }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.accepted) { router.push('/driver/active'); return }
    }
    setOffer(null)
    setResponding(false)
  }

  // Skip on /driver page (it has its own offer UI)
  if (pathname === '/driver') return null
  if (!offer) return null

  const shopName = offer.delivery?.order?.shop?.name || 'New Order'
  const earnings = (offer.delivery?.driver_earnings ?? 0).toFixed(2)
  const items = offer.delivery?.order?.items?.length || 0

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, maxWidth: 400, width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden',
      }}>
        <div style={{ background: '#FF8C00', padding: '20px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 4 }}>🚗</div>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>New Delivery!</div>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{shopName}</div>
          <div style={{ fontSize: 14, color: '#888', marginBottom: 16 }}>{items} item{items !== 1 ? 's' : ''}</div>
          <div style={{ background: '#FFF3E0', borderRadius: 10, padding: 16, textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: '#888' }}>You&apos;ll earn</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#FF8C00' }}>${earnings}</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => respond('accept')} disabled={responding} style={{
              flex: 1, padding: 16, borderRadius: 12, background: '#10B981', color: '#fff',
              fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: 18,
            }}>
              {responding ? '...' : '✓ Accept'}
            </button>
            <button onClick={() => respond('decline')} disabled={responding} style={{
              padding: '16px 24px', borderRadius: 12, background: '#FEE2E2', color: '#DC2626',
              fontWeight: 700, border: '1px solid #FCA5A5', cursor: 'pointer', fontSize: 16,
            }}>
              Decline
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
