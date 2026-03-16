'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useCart } from '@/lib/cart-context'

export default function Navbar() {
  const { user, loading, signOut } = useAuth()
  const { count } = useCart()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <nav className="nav-container">
      <div className="nav-inner">
        <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img src="/logo.png" alt="DonutDash" className="nav-logo-img" style={{ height: '100px', width: 'auto', position: 'relative', zIndex: 101, marginTop: '20px' }} />
        </Link>

        <div className="nav-links">
          <Link href="/shops" className="nav-link">Browse</Link>
          {user && <Link href="/orders" className="nav-link">Orders</Link>}
          <Link href="/cart" className="nav-link" style={{ position: 'relative' }}>
            Cart
            {count > 0 && (
              <span style={{
                position: 'absolute',
                top: '-8px',
                right: '-14px',
                background: '#FF1493',
                color: 'white',
                fontSize: '0.7rem',
                fontWeight: 700,
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {count}
              </span>
            )}
          </Link>

          {!loading && (
            <>
              {user ? (
                <div ref={menuRef} style={{ position: 'relative' }}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    style={{
                      background: '#FF1493',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '36px',
                      height: '36px',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {user.name?.charAt(0)?.toUpperCase() || 'U'}
                  </button>
                  {userMenuOpen && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '0.5rem',
                      background: 'white',
                      borderRadius: '10px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                      border: '1px solid #f0f0f0',
                      minWidth: '180px',
                      overflow: 'hidden',
                      zIndex: 200,
                    }}>
                      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f0f0f0' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{user.name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#888' }}>{user.email}</div>
                      </div>
                      <Link href="/orders" style={{
                        display: 'block', padding: '0.6rem 1rem', fontSize: '0.9rem',
                        transition: 'background 0.15s',
                      }}
                        onClick={() => setUserMenuOpen(false)}
                        onMouseEnter={e => (e.currentTarget.style.background = '#fff0f5')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        My Orders
                      </Link>
                      <button
                        onClick={() => { setUserMenuOpen(false); signOut() }}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '0.6rem 1rem', fontSize: '0.9rem',
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: '#FF1493', fontWeight: 500,
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#fff0f5')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link href="/login" style={{
                  background: '#FF1493',
                  color: 'white',
                  padding: '0.5rem 1.25rem',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  transition: 'background 0.2s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FF69B4')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#FF1493')}
                >
                  Sign In
                </Link>
              )}
            </>
          )}
        </div>

        <button
          className="mobile-menu-btn"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1A1A2E" strokeWidth="2">
            {mobileOpen ? (
              <path d="M18 6L6 18M6 6l12 12" />
            ) : (
              <path d="M3 12h18M3 6h18M3 18h18" />
            )}
          </svg>
        </button>
      </div>

      <div className={`mobile-nav ${mobileOpen ? 'open' : ''}`}>
        <Link href="/shops" onClick={() => setMobileOpen(false)}
          style={{ padding: '0.5rem 0', fontWeight: 500 }}>
          Browse
        </Link>
        {user && (
          <Link href="/orders" onClick={() => setMobileOpen(false)}
            style={{ padding: '0.5rem 0', fontWeight: 500 }}>
            Orders
          </Link>
        )}
        <Link href="/cart" onClick={() => setMobileOpen(false)}
          style={{ padding: '0.5rem 0', fontWeight: 500 }}>
          Cart {count > 0 && `(${count})`}
        </Link>
        {!loading && (
          user ? (
            <button onClick={() => { setMobileOpen(false); signOut() }}
              style={{
                background: 'none', border: 'none', textAlign: 'left',
                padding: '0.5rem 0', fontWeight: 500, color: '#FF1493',
                cursor: 'pointer', fontSize: '1rem',
              }}>
              Sign Out
            </button>
          ) : (
            <Link href="/login" onClick={() => setMobileOpen(false)}
              style={{ padding: '0.5rem 0', fontWeight: 600, color: '#FF1493' }}>
              Sign In
            </Link>
          )
        )}
      </div>
    </nav>
  )
}
