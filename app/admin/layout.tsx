'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import RoleAuthForm from '@/components/RoleAuthForm'

const ALL_NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: '📊', roles: ['admin', 'manager'] },
  { href: '/admin/shops', label: 'Shops', icon: '🏪', roles: ['admin', 'manager'] },
  { href: '/admin/users', label: 'Users', icon: '👥', roles: ['admin', 'manager'] },
  { href: '/admin/orders', label: 'Orders', icon: '📦', roles: ['admin', 'manager'] },
  { href: '/admin/drivers', label: 'Drivers', icon: '🚗', roles: ['admin', 'manager'] },
  { href: '/admin/driver-documents', label: 'Driver Docs', icon: '📋', roles: ['admin', 'manager'] },
  { href: '/admin/shop-documents', label: 'Shop Docs', icon: '📑', roles: ['admin', 'manager'] },
  { href: '/admin/payouts', label: 'Payouts', icon: '💰', roles: ['admin', 'manager'] },
  { href: '/admin/catering', label: 'Catering', icon: '🎂', roles: ['admin', 'manager'] },
  { href: '/admin/support', label: 'Support Chat', icon: '💬', roles: ['admin', 'manager'] },
  { href: '/admin/disputes', label: 'Disputes', icon: '⚠️', roles: ['admin', 'manager'] },
  { href: '/admin/tax', label: 'Tax Center', icon: '🧾', roles: ['admin'] },
  { href: '/admin/settings', label: 'Settings', icon: '⚙️', roles: ['admin'] },
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

  const isAdminOrManager = role === 'admin' || role === 'manager'
  const NAV_ITEMS = ALL_NAV_ITEMS.filter(item => item.roles.includes(role || ''))

  if (!user || !isAdminOrManager) {
    return (
      <RoleAuthForm
        role="admin"
        roleLabel="Admin"
        accentColor="#6366F1"
        accentHover="#818CF8"
        bgGradient="linear-gradient(135deg, #F0F0FF 0%, #FFFFFF 50%, #F8F9FA 100%)"
        icon="🛡️"
        tagline="Admin panel access"
        redirectTo="/admin"
      />
    )
  }

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  const sidebar = (
    <>
      <div style={{ padding: '24px 20px 16px' }}>
        <img src="/logo.png" alt="DonutDash" style={{ height: 40, width: 'auto', filter: 'brightness(10)' }} />
        <span style={{ background: role === 'manager' ? '#FF8C00' : '#6366F1', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, marginTop: 4, display: 'inline-block', letterSpacing: 1 }}>{role === 'manager' ? 'MANAGER' : 'ADMIN'}</span>
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
        <div style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{user.name}</div>
        <button
          onClick={() => signOut('/admin')}
          style={{ display: 'block', width: '100%', padding: '8px 12px', color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, textAlign: 'left' }}
        >
          Sign Out
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
