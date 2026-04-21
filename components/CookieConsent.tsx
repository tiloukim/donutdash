'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'dd_cookie_consent'

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Hide cookie banner in mobile app WebView
    if ((window as any).ReactNativeWebView) return
    const accepted = localStorage.getItem(STORAGE_KEY)
    if (!accepted) {
      setVisible(true)
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: '#1A1A2E',
        color: '#fff',
        padding: '1rem 1.5rem',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.5rem',
        flexWrap: 'wrap',
        borderTopLeftRadius: '12px',
        borderTopRightRadius: '12px',
      }}
    >
      <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5, maxWidth: '700px' }}>
        We use cookies to improve your experience. By continuing to use DonutDash, you agree to our{' '}
        <Link href="/privacy" style={{ color: '#FF8C00', textDecoration: 'underline' }}>
          Cookie Policy
        </Link>
        .
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexShrink: 0 }}>
        <Link
          href="/privacy"
          style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: '0.85rem',
            textDecoration: 'underline',
          }}
        >
          Learn More
        </Link>
        <button
          onClick={handleAccept}
          style={{
            background: '#FF8C00',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '0.6rem 1.5rem',
            fontSize: '0.9rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#E07B00')}
          onMouseLeave={e => (e.currentTarget.style.background = '#FF8C00')}
        >
          Accept
        </button>
      </div>
    </div>
  )
}
