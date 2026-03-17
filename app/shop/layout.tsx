'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import RoleAuthForm from '@/components/RoleAuthForm'

const NAV_ITEMS = [
  { href: '/shop', label: 'Dashboard', icon: '📊' },
  { href: '/shop/orders', label: 'Orders', icon: '📋' },
  { href: '/shop/menu', label: 'Menu', icon: '🍩' },
  { href: '/shop/hours', label: 'Hours', icon: '🕐' },
  { href: '/shop/settings', label: 'Settings', icon: '⚙️' },
]

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, role, signOut } = useAuth()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

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

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 220, background: '#FF1493', color: '#fff', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50 }} className="shop-sidebar">
        <div style={{ padding: '24px 20px 16px' }}>
          <img src="/logo.png" alt="DonutDash" style={{ height: 40, width: 'auto', filter: 'brightness(10)' }} />
          <span style={{ background: '#fff', color: '#FF1493', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, marginTop: 4, display: 'inline-block' }}>SHOP</span>
        </div>
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '0 8px' }}>
          {NAV_ITEMS.map(item => (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8,
              textDecoration: 'none', fontSize: 14, fontWeight: 600,
              color: pathname === item.href ? '#FF1493' : '#fff',
              background: pathname === item.href ? '#fff' : 'transparent',
            }}>
              <span>{item.icon}</span> {item.label}
            </Link>
          ))}
        </nav>
        <div style={{ padding: '16px 8px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
          <Link href="/" style={{ display: 'block', padding: '8px 12px', color: '#fff', textDecoration: 'none', fontSize: 13, opacity: 0.8 }}>← Back to App</Link>
          <button onClick={() => signOut()} style={{ display: 'block', width: '100%', padding: '8px 12px', color: '#FFB6C1', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, textAlign: 'left' }}>Logout</button>
        </div>
      </aside>
      <main style={{ flex: 1, marginLeft: 220, background: '#FFF5F8' }}>
        <header style={{ background: '#fff', borderBottom: '1px solid #FFE4EF', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A1A2E' }}>
            {NAV_ITEMS.find(n => n.href === pathname)?.label || 'Shop Dashboard'}
          </h1>
          <span style={{ fontSize: 14, color: '#666' }}>{user.name}</span>
        </header>
        <div style={{ padding: 24 }}>{children}</div>
      </main>
    </div>
  )
}
