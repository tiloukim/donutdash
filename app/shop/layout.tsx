'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import RoleAuthForm from '@/components/RoleAuthForm'
import { ShopLangProvider, useShopLang } from '@/lib/shop-lang-context'
import type { TranslationKey } from '@/lib/shop-i18n'

const NAV_ITEMS: { href: string; labelKey: TranslationKey; icon: string }[] = [
  { href: '/shop', labelKey: 'nav.dashboard', icon: '📊' },
  { href: '/shop/orders', labelKey: 'nav.orders', icon: '📋' },
  { href: '/shop/menu', labelKey: 'nav.menu', icon: '🍩' },
  { href: '/shop/analytics', labelKey: 'nav.analytics', icon: '📈' },
  { href: '/shop/hours', labelKey: 'nav.hours', icon: '🕐' },
  { href: '/shop/referral', labelKey: 'nav.referral', icon: '🎁' },
  { href: '/shop/support', labelKey: 'nav.support', icon: '💬' },
  { href: '/shop/disputes', labelKey: 'nav.issues', icon: '⚠️' },
  { href: '/shop/documents', labelKey: 'nav.documents', icon: '📄' },
  { href: '/shop/settings', labelKey: 'nav.settings', icon: '⚙️' },
]

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <ShopLangProvider>
      <ShopLayoutInner>{children}</ShopLayoutInner>
    </ShopLangProvider>
  )
}

function ShopLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, loading, role, signOut } = useAuth()
  const { lang, setLang, t } = useShopLang()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [shopName, setShopName] = useState<string>('')

  useEffect(() => {
    if (!user || (role !== 'shop_owner' && role !== 'admin')) return
    fetch('/api/shop/settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.name) setShopName(data.name) })
      .catch(() => {})
  }, [user, role])

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: 18 }}>Loading...</div>

  if (!user || (role !== 'shop_owner' && role !== 'admin')) {
    return (
      <RoleAuthForm
        role="shop_owner"
        roleLabel="Shop Owner"
        accentColor="#FF1493"
        accentHover="#FF69B4"
        bgGradient="linear-gradient(135deg, #FFF0F5 0%, #FFFFFF 50%, #FFFAF0 100%)"
        icon="🍩"
        tagline="Manage your donut shop"
        redirectTo="/shop"
      />
    )
  }

  const sidebar = (
    <>
      <div style={{ padding: '24px 20px 16px' }}>
        <img src="/logo.png" alt="DonutDash" style={{ height: 40, width: 'auto', filter: 'brightness(10)' }} />
        <div style={{ marginTop: 6 }}>
          <span style={{ background: '#fff', color: '#FF1493', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 4, display: 'inline-block' }}>
            {shopName || 'SHOP'}
          </span>
        </div>
      </div>
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '0 8px' }}>
        {NAV_ITEMS.map(item => (
          <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8,
            textDecoration: 'none', fontSize: 14, fontWeight: 600,
            color: pathname === item.href ? '#FF1493' : '#fff',
            background: pathname === item.href ? '#fff' : 'transparent',
          }}>
            <span>{item.icon}</span> {t(item.labelKey)}
          </Link>
        ))}
      </nav>
      <div style={{ padding: '16px 8px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
        <button
          onClick={() => setLang(lang === 'en' ? 'km' : 'en')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '8px 12px', color: '#fff', background: 'rgba(255,255,255,0.15)',
            border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            marginBottom: 6,
          }}
        >
          🌐 {lang === 'en' ? 'ភាសាខ្មែរ' : 'English'}
        </button>
        <div style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{user.name}</div>
        <button onClick={() => signOut('/shop')} style={{ display: 'block', width: '100%', padding: '8px 12px', color: '#FFB6C1', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, textAlign: 'left' }}>{t('nav.signOut')}</button>
      </div>
    </>
  )

  return (
    <>
    <head><link rel="manifest" href="/manifest-shop.json" /></head>
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Desktop sidebar */}
      <aside style={{
        width: 220, background: '#FF1493', color: '#fff', display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
      }} className="shop-sidebar-desktop">
        {sidebar}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90 }}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        style={{
          width: 260, background: '#FF1493', color: '#fff', display: 'none', flexDirection: 'column',
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease',
        }}
        className="shop-sidebar-mobile"
      >
        {sidebar}
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, marginLeft: 220, background: '#FFF5F8', minHeight: '100vh' }} className="shop-main">
        <header style={{ background: '#fff', borderBottom: '1px solid #FFE4EF', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, padding: 4 }}
              className="shop-hamburger"
            >
              ☰
            </button>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A1A2E' }}>
              {(() => { const nav = NAV_ITEMS.find(n => n.href === pathname); return nav ? t(nav.labelKey) : t('nav.dashboard') })()}
            </h1>
          </div>
          <span style={{ fontSize: 14, color: '#666' }}>{user.name}</span>
        </header>
        <div style={{ padding: 24 }}>{children}</div>
      </main>

      <style>{`
        @media (max-width: 768px) {
          .shop-sidebar-desktop { display: none !important; }
          .shop-sidebar-mobile { display: flex !important; }
          .shop-main { margin-left: 0 !important; }
          .shop-hamburger { display: block !important; }
        }
      `}</style>
    </div>
    </>
  )
}
