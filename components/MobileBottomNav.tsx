'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCart } from '@/lib/cart-context'
import { useAuth } from '@/lib/auth-context'
import { useState } from 'react'

export default function MobileBottomNav() {
  const pathname = usePathname()
  const { count } = useCart()
  const { user, signOut } = useAuth()
  const [showAccountMenu, setShowAccountMenu] = useState(false)

  const PINK = '#FF1493'
  const INACTIVE = '#999'

  function isActive(path: string) {
    if (path === '/') return pathname === '/'
    return pathname.startsWith(path)
  }

  const tabColor = (path: string) => isActive(path) ? PINK : INACTIVE

  return (
    <>
      {/* Account menu overlay */}
      {showAccountMenu && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            background: 'rgba(0,0,0,0.3)',
          }}
          onClick={() => setShowAccountMenu(false)}
        />
      )}

      {showAccountMenu && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(60px + env(safe-area-inset-bottom, 0px))',
          right: '8px',
          zIndex: 9999,
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
          minWidth: '200px',
          overflow: 'hidden',
        }}>
          {user ? (
            <>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1A1A2E' }}>{user.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#888' }}>{user.email}</div>
              </div>
              <Link
                href="/orders"
                onClick={() => setShowAccountMenu(false)}
                style={{ display: 'block', padding: '10px 16px', fontSize: '0.9rem', color: '#1A1A2E', textDecoration: 'none' }}
              >
                My Orders
              </Link>
              <button
                onClick={() => { setShowAccountMenu(false); signOut() }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '10px 16px', fontSize: '0.9rem',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: PINK, fontWeight: 600,
                }}
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              onClick={() => setShowAccountMenu(false)}
              style={{ display: 'block', padding: '12px 16px', fontSize: '0.95rem', color: PINK, fontWeight: 600, textDecoration: 'none' }}
            >
              Sign In / Sign Up
            </Link>
          )}
        </div>
      )}

      {/* Bottom Nav Bar */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9997,
        background: 'white',
        borderTop: '1px solid #eee',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        height: '60px',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
        className="mobile-bottom-nav"
      >
        {/* Home */}
        <Link href="/" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', flex: 1, gap: '2px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={tabColor('/')} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span style={{ fontSize: '0.65rem', fontWeight: isActive('/') ? 700 : 500, color: tabColor('/') }}>Home</span>
        </Link>

        {/* Browse */}
        <Link href="/shops" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', flex: 1, gap: '2px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={tabColor('/shops')} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
          <span style={{ fontSize: '0.65rem', fontWeight: isActive('/shops') ? 700 : 500, color: tabColor('/shops') }}>Browse</span>
        </Link>

        {/* Orders */}
        <Link href="/orders" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', flex: 1, gap: '2px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={tabColor('/orders')} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span style={{ fontSize: '0.65rem', fontWeight: isActive('/orders') ? 700 : 500, color: tabColor('/orders') }}>Orders</span>
        </Link>

        {/* Cart */}
        <Link href="/cart" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', flex: 1, gap: '2px', position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={tabColor('/cart')} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 01-8 0" />
            </svg>
            {count > 0 && (
              <span style={{
                position: 'absolute',
                top: '-6px',
                right: '-10px',
                background: PINK,
                color: 'white',
                fontSize: '0.6rem',
                fontWeight: 700,
                minWidth: '16px',
                height: '16px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
              }}>
                {count > 99 ? '99+' : count}
              </span>
            )}
          </div>
          <span style={{ fontSize: '0.65rem', fontWeight: isActive('/cart') ? 700 : 500, color: tabColor('/cart') }}>Cart</span>
        </Link>

        {/* Account */}
        <button
          onClick={() => setShowAccountMenu(!showAccountMenu)}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            flex: 1, gap: '2px', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={showAccountMenu ? PINK : INACTIVE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span style={{ fontSize: '0.65rem', fontWeight: showAccountMenu ? 700 : 500, color: showAccountMenu ? PINK : INACTIVE }}>Account</span>
        </button>
      </nav>

      {/* Style to hide on desktop */}
      <style>{`
        .mobile-bottom-nav {
          display: flex !important;
        }
        @media (min-width: 769px) {
          .mobile-bottom-nav {
            display: none !important;
          }
        }
      `}</style>
    </>
  )
}
