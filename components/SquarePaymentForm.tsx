'use client'

// Embedded Square Web Payments SDK card + Apple Pay + Google Pay form.
// Tokenizes the payment method client-side and hands the one-time token
// (`sourceId`) back to the parent, which charges it via /api/checkout.
// Uses NEXT_PUBLIC_SQUARE_APP_ID / _LOCATION_ID / _ENVIRONMENT.

import { useEffect, useRef, useState, useCallback, type CSSProperties } from 'react'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Square?: { payments: (appId: string, locationId: string) => Promise<any> }
  }
}

interface Props {
  onTokenize: (token: string) => void
  onError: (message: string) => void
  loading: boolean
  total: number
  disabled?: boolean
}

export default function SquarePaymentForm({ onTokenize, onError, loading, total, disabled = false }: Props) {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const cardRef = useRef<any>(null)
  const applePayRef = useRef<any>(null)
  const googlePayRef = useRef<any>(null)
  const paymentRequestRef = useRef<any>(null)
  const onTokenizeRef = useRef(onTokenize)
  const onErrorRef = useRef(onError)
  const initRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [applePayReady, setApplePayReady] = useState(false)
  const [googlePayReady, setGooglePayReady] = useState(false)

  useEffect(() => {
    onTokenizeRef.current = onTokenize
    onErrorRef.current = onError
  })

  // Keep the wallet payment request amount in sync with the live total.
  useEffect(() => {
    if (paymentRequestRef.current && total > 0) {
      try {
        paymentRequestRef.current.update({ total: { amount: total.toFixed(2), label: 'DonutDash' } })
      } catch { /* ignore */ }
    }
  }, [total])

  const walletTokenize = useCallback(async (wallet: any) => {
    try {
      const result = await wallet.tokenize()
      if (result.status === 'OK') onTokenizeRef.current(result.token)
      else onErrorRef.current(result.errors?.[0]?.message || 'Payment failed')
    } catch {
      onErrorRef.current('Payment processing failed')
    }
  }, [])

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    const appId = process.env.NEXT_PUBLIC_SQUARE_APP_ID!
    const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID!

    async function init() {
      if (!window.Square) { onErrorRef.current('Payment could not load. Please refresh.'); return }
      try {
        const payments = await window.Square.payments(appId, locationId)

        const card = await payments.card()
        await card.attach('#dd-card-container')
        cardRef.current = card
        setReady(true)

        const paymentRequest = payments.paymentRequest({
          countryCode: 'US',
          currencyCode: 'USD',
          total: { amount: (total > 0 ? total : 1).toFixed(2), label: 'DonutDash' },
        })
        paymentRequestRef.current = paymentRequest

        try {
          const applePay = await payments.applePay(paymentRequest)
          if (applePay) {
            if (typeof applePay.attach === 'function') await applePay.attach('#dd-apple-pay')
            applePayRef.current = applePay
            setApplePayReady(true)
          }
        } catch { /* Apple Pay unavailable on this device/browser */ }

        try {
          const googlePay = await payments.googlePay(paymentRequest)
          // We DON'T attach Square's rendered Google button — we render our own
          // so it can share the exact font/size as the Apple Pay button. tokenize
          // is triggered from our custom button's click (a real user gesture).
          googlePayRef.current = googlePay
          setGooglePayReady(true)
        } catch { /* Google Pay unavailable */ }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        onErrorRef.current(`Payment form couldn't load: ${msg}`)
      }
    }

    if (window.Square) { init(); return }
    if (document.querySelector('script[src*="square.js"]')) {
      const t = setInterval(() => { if (window.Square) { clearInterval(t); init() } }, 100)
      return () => clearInterval(t)
    }
    const script = document.createElement('script')
    const isProd = process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT?.toLowerCase() === 'production'
    script.src = isProd ? 'https://web.squarecdn.com/v1/square.js' : 'https://sandbox.web.squarecdn.com/v1/square.js'
    script.onload = init
    script.onerror = () => onErrorRef.current('Failed to load payment SDK.')
    document.head.appendChild(script)
  }, [total, walletTokenize])

  async function payWithCard() {
    if (!cardRef.current || loading || disabled) return
    try {
      const result = await cardRef.current.tokenize()
      if (result.status === 'OK') onTokenize(result.token)
      else onError(result.errors?.[0]?.message || 'Please check your card details.')
    } catch {
      onError('Payment processing failed.')
    }
  }

  // Shared style so Apple Pay & Google Pay buttons match exactly (same font).
  const walletBtnStyle: CSSProperties = {
    width: '100%', height: 48, borderRadius: 12, border: 'none',
    background: '#000', color: '#fff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 17, fontWeight: 500, letterSpacing: '-0.01em',
    textAlign: 'center', lineHeight: '48px', padding: 0,
    cursor: loading || disabled ? 'not-allowed' : 'pointer',
    opacity: loading || disabled ? 0.5 : 1,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      {/* Apple Pay — custom button so it can read "Pay with  Pay" (Apple's
          official button has no "Pay with" type). The  glyph is the Apple
          logo, which renders on Apple devices — exactly where applePayReady is
          true. Only shows in Safari on Apple devices. */}
      {applePayReady && (
        <button
          type="button"
          aria-label="Pay with Apple Pay"
          onClick={() => applePayRef.current && walletTokenize(applePayRef.current)}
          disabled={loading || disabled}
          style={walletBtnStyle}
        >
          Pay with&nbsp;{''}Pay
        </button>
      )}
      {/* Google Pay — custom button matching the Apple one (same font/size).
          tokenize() is triggered from this button's click gesture. */}
      {googlePayReady && (
        <button
          type="button"
          aria-label="Pay with Google Pay"
          onClick={() => googlePayRef.current && walletTokenize(googlePayRef.current)}
          disabled={loading || disabled}
          style={walletBtnStyle}
        >
          Pay with&nbsp;
          <svg width="20" height="20" viewBox="0 0 48 48" style={{ verticalAlign: 'middle' }} aria-hidden="true">
            <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
            <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
            <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
            <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
          </svg>
          &nbsp;Pay
        </button>
      )}

      {(applePayReady || googlePayReady) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#9CA3AF', fontSize: 13 }}>
          <div style={{ flex: 1, borderTop: '1px solid #eee' }} />
          <span>or pay with card</span>
          <div style={{ flex: 1, borderTop: '1px solid #eee' }} />
        </div>
      )}

      {/* Card fields (Square-hosted iframe) */}
      <div
        id="dd-card-container"
        style={{ minHeight: 90, border: '1px solid #E5E7EB', borderRadius: 12, padding: '4px 12px' }}
      />

      <button
        type="button"
        onClick={payWithCard}
        disabled={!ready || loading || disabled}
        style={{
          width: '100%', padding: '1rem',
          background: !ready || loading || disabled ? '#ccc' : '#FF8C00',
          color: '#fff', border: 'none', borderRadius: 12,
          fontSize: '1.05rem', fontWeight: 700,
          cursor: !ready || loading || disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {disabled ? 'Unavailable right now' : loading ? 'Processing…' : `Pay $${total.toFixed(2)}`}
      </button>
    </div>
  )
  /* eslint-enable @typescript-eslint/no-explicit-any */
}
