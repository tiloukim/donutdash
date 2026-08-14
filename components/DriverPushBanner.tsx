'use client'

// Nags a driver to turn on push notifications so they don't miss order offers.
// Shows until push is actually active. Handles the iOS quirk where web push
// only works once the app is added to the Home Screen (a Safari tab can't
// receive push), and the "blocked" case where the browser must be changed in
// settings.

import { useEffect, useState, useCallback } from 'react'
import { subscribeToPush } from '@/lib/push-notifications'

type State = 'checking' | 'ok' | 'prompt' | 'blocked' | 'ios-install'

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return window.matchMedia?.('(display-mode: standalone)').matches || (window.navigator as any).standalone === true
}

export default function DriverPushBanner() {
  const [state, setState] = useState<State>('checking')
  const [busy, setBusy] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const check = useCallback(async () => {
    if (typeof window === 'undefined') return
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

    // iOS: push requires the app installed to the Home Screen.
    if (isIOS() && !isStandalone()) { setState('ios-install'); return }
    if (!supported) { setState(isIOS() ? 'ios-install' : 'ok'); return }

    if (Notification.permission === 'denied') { setState('blocked'); return }
    if (Notification.permission === 'granted') {
      try {
        const reg = await navigator.serviceWorker.ready
        const existing = await reg.pushManager.getSubscription()
        if (existing) { setState('ok'); return }
        const sub = await subscribeToPush() // granted but not registered yet
        setState(sub ? 'ok' : 'prompt')
      } catch { setState('prompt') }
      return
    }
    setState('prompt') // permission === 'default'
  }, [])

  useEffect(() => { check() }, [check])

  const enable = async () => {
    setBusy(true)
    try {
      const perm = await Notification.requestPermission()
      if (perm === 'granted') {
        const sub = await subscribeToPush()
        setState(sub ? 'ok' : 'prompt')
      } else if (perm === 'denied') {
        setState('blocked')
      }
    } catch { /* ignore */ }
    setBusy(false)
  }

  if (state === 'checking' || state === 'ok' || dismissed) return null

  const wrap: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    background: 'linear-gradient(135deg, #FF8C00, #FF7A00)', color: '#fff',
    padding: '12px 16px', margin: '0 0 12px', borderRadius: 12,
    boxShadow: '0 2px 10px rgba(255,140,0,0.25)',
  }
  const text: React.CSSProperties = { flex: '1 1 220px', fontSize: 14, fontWeight: 600, lineHeight: 1.4, minWidth: 0 }
  const btn: React.CSSProperties = {
    background: '#fff', color: '#B45309', border: 'none', borderRadius: 8,
    padding: '9px 16px', fontSize: 14, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
  }
  const closeBtn: React.CSSProperties = {
    background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.85)',
    fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: '0 2px', flexShrink: 0,
  }

  return (
    <div style={wrap} role="alert">
      {state === 'prompt' && (
        <>
          <div style={text}>🔔 Turn on notifications so you never miss an order offer.</div>
          <button style={btn} onClick={enable} disabled={busy}>{busy ? 'Enabling…' : 'Enable alerts'}</button>
        </>
      )}
      {state === 'ios-install' && (
        <div style={text}>
          📲 To get order alerts on iPhone, add DonutDash to your Home Screen: tap the <strong>Share</strong> icon, then <strong>“Add to Home Screen,”</strong> and open it from there.
        </div>
      )}
      {state === 'blocked' && (
        <div style={text}>
          🔕 Notifications are blocked. Turn them on for donutdash.app in your browser settings so you don’t miss orders.
        </div>
      )}
      <button style={closeBtn} onClick={() => setDismissed(true)} aria-label="Dismiss">×</button>
    </div>
  )
}
