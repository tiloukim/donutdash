'use client'

import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      reset: (id: string) => void
    }
  }
}

export default function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    if (!siteKey) return

    // Load Turnstile script
    if (!document.getElementById('cf-turnstile-script')) {
      const script = document.createElement('script')
      script.id = 'cf-turnstile-script'
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      document.head.appendChild(script)
    }

    const interval = setInterval(() => {
      if (window.turnstile && ref.current && !widgetId.current) {
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          callback: (token: string) => onToken(token),
          theme: 'light',
        })
        clearInterval(interval)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [onToken])

  return <div ref={ref} style={{ marginTop: 8 }} />
}
