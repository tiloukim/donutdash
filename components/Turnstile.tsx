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

    ;(window as any).__onTurnstileCallback = (token: string) => {
      callbackRef.current(token)
    }
    ;(window as any).__onTurnstileExpired = () => {
      callbackRef.current('')
    }
    ;(window as any).__onTurnstileError = () => {
      callbackRef.current('')
    }

    const existing = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')
    if (!existing) {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
      script.async = true
      document.head.appendChild(script)
    }

    if (ref.current && !rendered.current) {
      ref.current.innerHTML = ''
      const widget = document.createElement('div')
      widget.className = 'cf-turnstile'
      widget.dataset.sitekey = siteKey
      widget.dataset.callback = '__onTurnstileCallback'
      widget.dataset.expiredCallback = '__onTurnstileExpired'
      widget.dataset.errorCallback = '__onTurnstileError'
      widget.dataset.refreshExpired = 'auto'
      widget.dataset.theme = 'light'
      ref.current.appendChild(widget)
      rendered.current = true

      if ((window as any).turnstile) {
        ;(window as any).turnstile.render(widget, {
          sitekey: siteKey,
          callback: (token: string) => callbackRef.current(token),
          'expired-callback': () => callbackRef.current(''),
          'error-callback': () => callbackRef.current(''),
          'refresh-expired': 'auto',
          theme: 'light',
        })
      }
    }
  }, [siteKey])

  if (!siteKey) return null

  return <div ref={ref} style={{ marginTop: 8 }} />
}
