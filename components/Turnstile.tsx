'use client'

import { useEffect, useRef, useCallback } from 'react'

export default function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const rendered = useRef(false)
  const callbackRef = useRef(onToken)
  callbackRef.current = onToken

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (!siteKey || rendered.current) return

    // Define global callback
    ;(window as any).__onTurnstileCallback = (token: string) => {
      callbackRef.current(token)
    }

    // Load script
    const existing = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')
    if (!existing) {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
      script.async = true
      document.head.appendChild(script)
    }

    // Render widget via data attributes
    if (ref.current && !rendered.current) {
      ref.current.innerHTML = ''
      const widget = document.createElement('div')
      widget.className = 'cf-turnstile'
      widget.dataset.sitekey = siteKey
      widget.dataset.callback = '__onTurnstileCallback'
      widget.dataset.theme = 'light'
      ref.current.appendChild(widget)
      rendered.current = true

      // If script already loaded, re-render
      if ((window as any).turnstile) {
        ;(window as any).turnstile.render(widget, {
          sitekey: siteKey,
          callback: (token: string) => callbackRef.current(token),
          theme: 'light',
        })
      }
    }
  }, [siteKey])

  if (!siteKey) return null

  return <div ref={ref} style={{ marginTop: 8 }} />
}
