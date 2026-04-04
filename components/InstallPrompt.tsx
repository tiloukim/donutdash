'use client'

import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Don't show if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) return
    // Don't show if previously dismissed
    if (localStorage.getItem('pwa-install-dismissed')) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShow(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShow(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShow(false)
    localStorage.setItem('pwa-install-dismissed', '1')
  }

  if (!show) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 9998,
      padding: '12px 16px',
      paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      background: '#2D1B00',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      fontSize: 14,
      boxShadow: '0 -2px 12px rgba(0,0,0,0.15)',
    }}>
      <span style={{ flex: 1 }}>
        Add DonutDash to your home screen for a better experience
      </span>
      <button
        onClick={handleInstall}
        style={{
          background: '#FF8C00',
          color: '#fff',
          border: 'none',
          padding: '8px 16px',
          borderRadius: 8,
          fontWeight: 700,
          fontSize: 14,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Install
      </button>
      <button
        onClick={handleDismiss}
        style={{
          background: 'none',
          color: '#D4A574',
          border: 'none',
          padding: '8px',
          cursor: 'pointer',
          fontSize: 18,
          lineHeight: 1,
        }}
        aria-label="Dismiss"
      >
        &times;
      </button>
    </div>
  )
}
