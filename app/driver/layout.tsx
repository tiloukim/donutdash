'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

const NAV_ITEMS = [
  { href: '/driver', label: 'Home', icon: '📍' },
  { href: '/driver/active', label: 'Active', icon: '🚗' },
  { href: '/driver/earnings', label: 'Earnings', icon: '💵' },
  { href: '/driver/settings', label: 'Settings', icon: '⚙️' },
]

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, role, signOut } = useAuth()
  const pathname = usePathname()

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: 18 }}>Loading...</div>

  if (!user || (role !== 'driver' && role !== 'admin')) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: 16, padding: 20 }}>
        <div style={{ fontSize: 48 }}>🔒</div>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Access Denied</h1>
        <p style={{ color: '#666', textAlign: 'center' }}>You need a driver account to access this dashboard.</p>
        <Link href="/" style={{ background: '#FF8C00', color: '#fff', padding: '12px 24px', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>Back to Home</Link>
      </div>
    )
  }

  return (
    <>
      <style>{`
        .driver-layout { display: flex; flex-direction: column; min-height: 100vh; min-height: 100dvh; }
        .driver-sidebar { display: none; }
        .driver-main { flex: 1; background: #FFFAF5; padding-bottom: 72px; }
        .driver-header { background: #fff; border-bottom: 1px solid #FFE8D6; padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 40; }
        .driver-header h1 { font-size: 18px; font-weight: 700; color: #1A1A2E; margin: 0; }
        .driver-content { padding: 16px; }
        .driver-bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; background: #2D1B00; display: flex; justify-content: space-around; padding: 8px 0; padding-bottom: max(8px, env(safe-area-inset-bottom)); z-index: 50; border-top: 1px solid rgba(255,255,255,0.1); }
        .driver-bottom-nav a { display: flex; flex-direction: column; align-items: center; gap: 2px; text-decoration: none; font-size: 10px; font-weight: 600; padding: 4px 12px; border-radius: 8px; }
        .driver-bottom-nav a span.icon { font-size: 22px; }
        .driver-bottom-nav a.active { color: #FF8C00; }
        .driver-bottom-nav a:not(.active) { color: #D4A574; }

        @media (min-width: 768px) {
          .driver-layout { flex-direction: row; }
          .driver-sidebar { display: flex; flex-direction: column; width: 220px; background: #2D1B00; color: #fff; position: fixed; top: 0; left: 0; bottom: 0; z-index: 50; }
          .driver-main { margin-left: 220px; padding-bottom: 0; }
          .driver-content { padding: 24px; }
          .driver-header { padding: 16px 24px; }
          .driver-header h1 { font-size: 20px; }
          .driver-bottom-nav { display: none; }
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
            <Link href="/" style={{ display: 'block', padding: '8px 12px', color: '#D4A574', textDecoration: 'none', fontSize: 13 }}>← Back to App</Link>
            <button onClick={() => signOut()} style={{ display: 'block', width: '100%', padding: '8px 12px', color: '#FF8C00', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, textAlign: 'left' }}>Logout</button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="driver-main">
          <header className="driver-header">
            <h1>{NAV_ITEMS.find(n => n.href === pathname)?.label || 'Driver'}</h1>
            <span style={{ fontSize: 13, color: '#666' }}>{user.name}</span>
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
    </>
  )
}
