'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  let sid = sessionStorage.getItem('dd_sid')
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36)
    sessionStorage.setItem('dd_sid', sid)
  }
  return sid
}

export default function PageTracker() {
  const pathname = usePathname()
  const lastPath = useRef('')
  const { user } = useAuth()

  useEffect(() => {
    // Skip admin pages and API routes
    if (pathname.startsWith('/admin') || pathname.startsWith('/api')) return
    // Skip duplicate tracking
    if (pathname === lastPath.current) return
    lastPath.current = pathname

    const sessionId = getSessionId()

    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: pathname,
        referrer: document.referrer || null,
        sessionId,
        userId: user?.id || null,
      }),
    }).catch(() => {}) // fail silently
  }, [pathname, user])

  return null
}
