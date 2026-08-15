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
    display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
    background: 'linear-gradient(135deg, #FF7A00, #F43F5E)', color: '#fff',
    padding: '16px 18px', margin: '0 0 14px', borderRadius: 14,
    boxShadow: '0 4px 18px rgba(244,63,94,0.28)',
    border: '1px solid rgba(255,255,255,0.15)',
  }
  const headline: React.CSSProperties = { fontSize: 16, fontWeight: 800, marginBottom: 3, lineHeight: 1.25 }
  const sub: React.CSSProperties = { fontSize: 13.5, fontWeight: 500, lineHeight: 1.45, opacity: 0.96 }
  const btn: React.CSSProperties = {
    background: '#fff', color: '#B4152F', border: 'none', borderRadius: 10,
    padding: '13px 22px', fontSize: 15.5, fontWeight: 800, cursor: 'pointer',
    whiteSpace: 'nowrap', flex: '1 1 auto', minWidth: 150,
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  }
  const closeBtn: React.CSSProperties = {
    background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.85)',
    fontSize: 22, lineHeight: 1, cursor: 'pointer', padding: '0 2px', flexShrink: 0,
  }

  return (
    <div style={wrap} role="alert">
      <style>{`
        @keyframes ddAlertPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.035)} }
        @media (prefers-reduced-motion: no-preference) {
          .dd-alert-btn { animation: ddAlertPulse 1.8s ease-in-out infinite; }
        }
      `}</style>
      <div style={{ fontSize: 30, lineHeight: 1, flexShrink: 0 }}>🔔</div>
      <div style={{ flex: '1 1 230px', minWidth: 0 }}>
        {state === 'prompt' && (
          <>
            <div style={headline}>Turn on order alerts</div>
            <div style={sub}>You won’t receive delivery offers until alerts are on — it only takes one tap.</div>
          </>
        )}
        {state === 'ios-install' && (
          <>
            <div style={headline}>📲 Get order alerts on your iPhone</div>
            <div style={sub}>Tap the <strong>Share</strong> icon, then <strong>“Add to Home Screen,”</strong> and open DonutDash from that icon to enable alerts. We’ll also text you offers in the meantime.</div>
          </>
        )}
        {state === 'blocked' && (
          <>
            <div style={headline}>🔕 Your alerts are blocked</div>
            <div style={sub}>Turn on notifications for donutdash.app in your browser settings so you don’t miss orders. We’ll text you offers in the meantime.</div>
          </>
        )}
      </div>
      {state === 'prompt' ? (
        <button className="dd-alert-btn" style={btn} onClick={enable} disabled={busy}>
          {busy ? 'Enabling…' : '🔔 Enable alerts'}
        </button>
      ) : (
        <button style={closeBtn} onClick={() => setDismissed(true)} aria-label="Dismiss">×</button>
      )}
    </div>
  )
}
