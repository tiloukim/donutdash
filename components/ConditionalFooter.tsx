'use client'

import { usePathname } from 'next/navigation'
import Footer from './Footer'

const HIDE_PATTERNS: RegExp[] = [
  /^\/admin(\/|$)/,
  /^\/driver(\/|$)/,
  /^\/shop(\/|$)/,
  /^\/auth(\/|$)/,
  /^\/checkout(\/|$)/,
  /^\/partner-setup(\/|$)/,
  /^\/login$/,
  /^\/signup$/,
  /^\/forgot-password$/,
  /^\/reset-password$/,
]

export default function ConditionalFooter() {
  const pathname = usePathname() || ''
  // On gated/app routes the full marketing footer is hidden, but the
  // "Powered by" attribution still appears site-wide as a slim bar.
  if (HIDE_PATTERNS.some(p => p.test(pathname))) return <PoweredByBar />
  return <Footer />
}

function PoweredByBar() {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '0.75rem 1rem',
        fontSize: '0.72rem',
        color: '#9ca3af',
        borderTop: '1px solid rgba(0,0,0,0.06)',
      }}
    >
      Powered by DonutDash Technologies LLC
    </div>
  )
}
