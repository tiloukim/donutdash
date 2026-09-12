'use client'

import { useState } from 'react'

type Party = 'shop' | 'driver' | 'customer'

/**
 * Opens an anonymous line to another party on an order.
 *
 * There is no number here on purpose. The button names a role; the server
 * resolves both numbers, rings this user first, and bridges outward once they
 * pick up. Everyone sees the DonutDash number and nobody keeps anybody's
 * number after the order closes.
 */
export default function CallButton({
  orderId, to, label, style, compact = false,
}: {
  orderId: string
  to: Party
  label?: string
  style?: React.CSSProperties
  compact?: boolean
}) {
  const [state, setState] = useState<'idle' | 'calling' | 'ringing'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function call() {
    if (state !== 'idle') return
    setState('calling')
    setError(null)
    try {
      const res = await fetch('/api/calls/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, to }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not start the call')
        setState('idle')
        return
      }
      setState('ringing')
      // Long enough to read, short enough that a second attempt isn't blocked
      // if they missed the first ring.
      setTimeout(() => setState('idle'), 15000)
    } catch {
      setError('Could not start the call')
      setState('idle')
    }
  }

  const text = state === 'ringing'
    ? 'Answer your phone'
    : state === 'calling'
      ? 'Starting…'
      : label || `Call ${to}`

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <button
        onClick={call}
        disabled={state !== 'idle'}
        title="Connects you without either of you seeing the other's number"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: state === 'ringing' ? '#10B981' : '#FF1493',
          color: '#fff', border: 'none', borderRadius: 8,
          padding: compact ? '5px 10px' : '8px 14px',
          fontSize: compact ? 12 : 14, fontWeight: 600,
          cursor: state === 'idle' ? 'pointer' : 'default',
          opacity: state === 'calling' ? 0.7 : 1,
          ...style,
        }}
      >
        📞 {text}
      </button>
      {error && <span style={{ fontSize: 11, color: '#DC2626' }}>{error}</span>}
    </span>
  )
}
