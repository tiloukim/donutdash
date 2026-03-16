'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: '📊' },
  { href: '/admin/shops', label: 'Shops', icon: '🏪' },
  { href: '/admin/users', label: 'Users', icon: '👥' },
  { href: '/admin/orders', label: 'Orders', icon: '📦' },
  { href: '/admin/drivers', label: 'Drivers', icon: '🚗' },
  { href: '/admin/settings', label: 'Settings', icon: '⚙️' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, role, signOut } = useAuth()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: 18, background: '#F8F9FA' }}>
        Loading...
      </div>
    )
  }

  if (!user || role !== 'admin') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: 16, background: '#F8F9FA' }}>
        <div style={{ fontSize: 48 }}>🔒</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1A1A2E' }}>Access Denied</h1>
        <p style={{ color: '#666' }}>You need an admin account to access this panel.</p>
        <Link href="/" style={{ background: '#6366F1', color: '#fff', padding: '12px 24px', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>Back to Home</Link>
      </div>
    )
  }

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  const sidebar = (
    <>
      <div style={{ padding: '24px 20px 16px' }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>🍩 DonutDash</h2>
        <span style={{ background: '#6366F1', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, marginTop: 4, display: 'inline-block', letterSpacing: 1 }}>ADMIN</span>
      </div>
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '0 8px' }}>
        {NAV_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8,
              textDecoration: 'none', fontSize: 14, fontWeight: 600,
              color: isActive(item.href) ? '#6366F1' : 'rgba(255,255,255,0.8)',
              background: isActive(item.href) ? '#fff' : 'transparent',
              transition: 'all 0.15s',
            }}
          >
            <span>{item.icon}</span> {item.label}
          </Link>
        ))}
      </nav>
      <div style={{ padding: '16px 8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <Link href="/" style={{ display: 'block', padding: '8px 12px', color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: 13 }}>
          ← Back to App
        </Link>
        <button
          onClick={() => signOut()}
          style={{ display: 'block', width: '100%', padding: '8px 12px', color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, textAlign: 'left' }}
        >
          Logout
        </button>
      </div>
    </>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Desktop sidebar */}
      <aside style={{
        width: 230, background: '#1A1A2E', color: '#fff', display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
      }} className="admin-sidebar-desktop">
        {sidebar}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90 }}
          className="admin-overlay"
        />
      )}

      {/* Mobile sidebar */}
      <aside
        style={{
          width: 260, background: '#1A1A2E', color: '#fff', display: 'none', flexDirection: 'column',
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease',
        }}
        className="admin-sidebar-mobile"
      >
        {sidebar}
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, marginLeft: 230, background: '#F8F9FA', minHeight: '100vh' }} className="admin-main">
        <header style={{
          background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '16px 24px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, padding: 4 }}
              className="admin-hamburger"
            >
              ☰
            </button>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A1A2E' }}>
              {NAV_ITEMS.find(n => isActive(n.href))?.label || 'Admin'}
            </h1>
          </div>
          <span style={{ fontSize: 14, color: '#666' }}>{user.name}</span>
        </header>
        <div style={{ padding: 24 }}>{children}</div>
      </main>

      <style>{`
        @media (max-width: 768px) {
          .admin-sidebar-desktop { display: none !important; }
          .admin-sidebar-mobile { display: flex !important; }
          .admin-main { margin-left: 0 !important; }
          .admin-hamburger { display: block !important; }
        }
      `}</style>
    </div>
  )
}
