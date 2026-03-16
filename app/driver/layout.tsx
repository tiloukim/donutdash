'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

const NAV_ITEMS = [
  { href: '/driver', label: 'Available', icon: '📍' },
  { href: '/driver/active', label: 'Active Delivery', icon: '🚗' },
  { href: '/driver/earnings', label: 'Earnings', icon: '💵' },
  { href: '/driver/settings', label: 'Settings', icon: '⚙️' },
]

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, role, signOut } = useAuth()
  const pathname = usePathname()

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: 18 }}>Loading...</div>

  if (!user || (role !== 'driver' && role !== 'admin')) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 48 }}>🔒</div>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Access Denied</h1>
        <p style={{ color: '#666' }}>You need a driver account to access this dashboard.</p>
        <Link href="/" style={{ background: '#FF8C00', color: '#fff', padding: '12px 24px', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>Back to Home</Link>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 220, background: '#2D1B00', color: '#fff', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50 }}>
        <div style={{ padding: '24px 20px 16px' }}>
          <h2 style={{ fontSize: 20, fontWeight: 800 }}>🍩 DonutDash</h2>
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
      <main style={{ flex: 1, marginLeft: 220, background: '#FFFAF5' }}>
        <header style={{ background: '#fff', borderBottom: '1px solid #FFE8D6', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A1A2E' }}>
            {NAV_ITEMS.find(n => n.href === pathname)?.label || 'Driver Dashboard'}
          </h1>
          <span style={{ fontSize: 14, color: '#666' }}>{user.name}</span>
        </header>
        <div style={{ padding: 24 }}>{children}</div>
      </main>
    </div>
  )
}
