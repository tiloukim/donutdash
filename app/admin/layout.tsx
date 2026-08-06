'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import RoleAuthForm from '@/components/RoleAuthForm'
import {
  applyPermissionGuards,
  canAccessAdminPortal,
  matchAdminSection,
  PAGE_ROLES,
  ROLE_BADGES,
  type AdminPortalRole,
} from '@/lib/admin-auth'

// Quick-jump links to the other portals. Admin + manager roles can
// navigate in as their own session for QA / support / spot-checks.
// Opened in a new tab so the admin's place in the dashboard isn't
// lost — closing the tab pops them right back here.
const PORTAL_LINKS = [
  { href: '/driver', label: 'Driver Portal', icon: '🚗' },
  { href: '/shop', label: 'Shop Portal', icon: '🏪' },
  { href: '/shops', label: 'Customer Site', icon: '🛒' },
]

// Order + presentation only. The role-gating itself lives in
// PAGE_ROLES (lib/admin-auth.ts) — single source of truth.
const ALL_NAV_ITEMS: { href: keyof typeof PAGE_ROLES; label: string; icon: string }[] = [
  { href: '/admin',                  label: 'Dashboard',       icon: '📊' },
  { href: '/admin/shops',            label: 'Shops',           icon: '🏪' },
  { href: '/admin/users',            label: 'Users',           icon: '👥' },
  { href: '/admin/orders',           label: 'Orders',          icon: '📦' },
  { href: '/admin/drivers',          label: 'Drivers',         icon: '🚗' },
  { href: '/admin/driver-documents', label: 'Driver Docs',     icon: '📋' },
  { href: '/admin/shop-documents',   label: 'Shop Docs',       icon: '📑' },
  { href: '/admin/claim-requests',   label: 'Claim Requests',  icon: '🏷️' },
  { href: '/admin/payouts',          label: 'Payouts',         icon: '💰' },
  { href: '/admin/sponsorships',     label: 'Sponsorships',    icon: '⭐' },
  { href: '/admin/catering',         label: 'Catering',        icon: '🎂' },
  { href: '/admin/support',          label: 'Support Chat',    icon: '💬' },
  { href: '/admin/voicemails',       label: 'Voicemails',      icon: '📞' },
  { href: '/admin/ivr',              label: 'IVR Settings',    icon: '☎️' },
  { href: '/admin/ivr-extensions',   label: 'IVR Extensions',  icon: '🔢' },
  { href: '/admin/disputes',         label: 'Disputes',        icon: '⚠️' },
  { href: '/admin/flyers',           label: 'Shop Flyers',     icon: '📄' },
  { href: '/admin/menu-templates',   label: 'Menu Templates',  icon: '🍩' },
  { href: '/admin/team',             label: 'Team Cards',      icon: '🪪' },
  { href: '/admin/analytics',        label: 'Live Analytics',  icon: '📈' },
  { href: '/admin/pitch-campaign',   label: 'Pitch Campaign',  icon: '📣' },
  { href: '/admin/access-matrix',    label: 'Role Access',     icon: '🎨' },
  { href: '/admin/tax',              label: 'Tax Center',      icon: '🧾' },
  { href: '/admin/settings',         label: 'Settings',        icon: '⚙️' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, role, signOut } = useAuth()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Live permissions from dd_role_permissions, fetched once per mount.
  // Until they load we render with the static PAGE_ROLES fallback so
  // there's no nav flash. applyPermissionGuards is what /api returns
  // anyway, but apply it locally too so the fallback stays consistent
  // with the lockout safety rails.
  const [livePermissions, setLivePermissions] = useState<
    Record<string, readonly AdminPortalRole[]> | null
  >(null)

  useEffect(() => {
    if (!canAccessAdminPortal(role)) return
    fetch('/api/admin/role-permissions')
      .then(r => r.json())
      .then(data => {
        if (data.permissions) setLivePermissions(data.permissions)
      })
      .catch(() => { /* fall back silently to static defaults */ })
  }, [role])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: 18, background: '#F8F9FA' }}>
        Loading...
      </div>
    )
  }

  const effectivePermissions = livePermissions ?? applyPermissionGuards(PAGE_ROLES)

  const NAV_ITEMS = canAccessAdminPortal(role)
    ? ALL_NAV_ITEMS.filter(item =>
        effectivePermissions[item.href]?.includes(role as AdminPortalRole),
      )
    : []
  const badge = canAccessAdminPortal(role) ? ROLE_BADGES[role] : null

  if (!user || !canAccessAdminPortal(role)) {
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

  // Defense-in-depth: even if a manager guesses an admin-only URL, the
  // layout swaps the page body for a Forbidden card. Sidebar still
  // renders so they can navigate somewhere they DO have access to.
  const section = matchAdminSection(pathname)
  const isAllowedHere = section
    ? (effectivePermissions[section]?.includes(role as AdminPortalRole) ?? false)
    : role === 'admin'

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  const sidebar = (
    <>
      <div style={{ padding: '16px 20px 10px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center' }}><img src="/logo.png" alt="DonutDash" style={{ height: 40, width: 'auto', filter: 'brightness(10)' }} /><sup style={{ fontSize: 20, fontWeight: 800, marginLeft: 2, position: 'relative', top: 10, color: '#fff' }}>™</sup></span>
        {badge && (
          <span style={{ background: badge.color, color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, marginTop: 4, display: 'inline-block', letterSpacing: 1 }}>
            {badge.label}
          </span>
        )}
      </div>
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, padding: '0 8px', overflowY: 'auto' }}>
        {NAV_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderRadius: 8,
              textDecoration: 'none', fontSize: 13, fontWeight: 600,
              color: isActive(item.href) ? '#6366F1' : 'rgba(255,255,255,0.8)',
              background: isActive(item.href) ? '#fff' : 'transparent',
              transition: 'all 0.15s',
            }}
          >
            <span>{item.icon}</span> {item.label}
          </Link>
        ))}
      </nav>
      <div style={{ padding: '12px 8px 6px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ padding: '4px 12px 8px', color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 800, letterSpacing: 1.2 }}>
          VIEW AS
        </div>
        {PORTAL_LINKS.map(portal => (
          <a
            key={portal.href}
            href={portal.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderRadius: 8,
              textDecoration: 'none', fontSize: 13, fontWeight: 600,
              color: 'rgba(255,255,255,0.8)', background: 'transparent',
              transition: 'background 0.15s',
            }}
          >
            <span>{portal.icon}</span>
            <span style={{ flex: 1 }}>{portal.label}</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>↗</span>
          </a>
        ))}
      </div>
      <div style={{ padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
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
      <main style={{ flex: 1, minWidth: 0, marginLeft: 230, background: '#F8F9FA', minHeight: '100vh' }} className="admin-main">
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
        <div style={{ padding: 24 }}>
          {isAllowedHere ? children : (
            <div style={{
              maxWidth: 480, margin: '60px auto', background: '#fff',
              border: '1px solid #FCA5A5', borderRadius: 12, padding: 32,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🚫</div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#991B1B', marginBottom: 8 }}>
                You don&apos;t have access to this page
              </h2>
              <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 20 }}>
                Your {badge?.label.toLowerCase() ?? 'current'} role can&apos;t view this section. Pick something from the sidebar, or ask an admin to grant access.
              </p>
              <Link href="/admin" style={{
                display: 'inline-block', padding: '10px 20px', borderRadius: 8,
                background: '#6366F1', color: '#fff', textDecoration: 'none',
                fontSize: 14, fontWeight: 600,
              }}>
                Back to Dashboard
              </Link>
            </div>
          )}
        </div>
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
