'use client'

// Embedded Square Web Payments SDK card + Apple Pay + Google Pay form.
// Tokenizes the payment method client-side and hands the one-time token
// (`sourceId`) back to the parent, which charges it via /api/checkout.
// Uses NEXT_PUBLIC_SQUARE_APP_ID / _LOCATION_ID / _ENVIRONMENT.

import { useEffect, useRef, useState, useCallback } from 'react'

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
          // fill = span the container width (matches the full-width Apple Pay /
          // card buttons); black to match Apple Pay.
          await googlePay.attach('#dd-google-pay', { buttonColor: 'black', buttonType: 'order', buttonSizeMode: 'fill' })
          // Square renders its button INTO the div; the click must be handled on
          // the DOM element. The googlePay object has no addEventListener, so the
          // old `googlePay.addEventListener?.(...)` silently no-oped and the
          // button did nothing when tapped.
          const gpEl = document.getElementById('dd-google-pay')
          gpEl?.addEventListener('click', async (e) => {
            e.preventDefault()
            await walletTokenize(googlePay)
          })
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      {/* Apple Pay — Apple's official button style renders the  Pay mark
          (with the Apple logo) per Apple's design guidelines. Only works in
          Safari on Apple devices, which is exactly where applePayReady is true. */}
      {applePayReady && (
        <>
          <style>{`
            .dd-apple-pay-button {
              -webkit-appearance: -apple-pay-button;
              appearance: -apple-pay-button;
              -apple-pay-button-type: order;
              -apple-pay-button-style: black;
              width: 100%; height: 48px; border-radius: 12px; border: none; cursor: pointer;
            }
            .dd-apple-pay-button:disabled { opacity: 0.5; cursor: not-allowed; }
          `}</style>
          <button
            type="button"
            className="dd-apple-pay-button"
            aria-label="Pay with Apple Pay"
            onClick={() => applePayRef.current && walletTokenize(applePayRef.current)}
            disabled={loading || disabled}
          />
        </>
      )}
      {/* Google Pay (Square renders its own button here). Fixed 48px height +
          rounded, clipped corners so it lines up with the Apple Pay / card
          buttons instead of rendering at Google's default size. */}
      <div
        id="dd-google-pay"
        style={{
          height: googlePayReady ? 48 : 0,
          borderRadius: 12,
          overflow: 'hidden',
          opacity: loading || disabled ? 0.5 : 1,
          pointerEvents: loading || disabled ? 'none' : 'auto',
        }}
      />

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
