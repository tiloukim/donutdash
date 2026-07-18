'use client'

import { usePathname } from 'next/navigation'
import Footer from './Footer'

// Internal app dashboards — no footer at all (not even the "Powered by" bar).
const NO_FOOTER_PATTERNS: RegExp[] = [
  /^\/admin(\/|$)/,
  /^\/driver(\/|$)/,
  /^\/shop(\/|$)/,
]

// Routes where the full marketing footer is hidden but the slim
// "Powered by" attribution bar still shows.
const HIDE_PATTERNS: RegExp[] = [
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
  // Internal dashboards get nothing.
  if (NO_FOOTER_PATTERNS.some(p => p.test(pathname))) return null
  // Other gated routes hide the full footer but keep the attribution bar.
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
