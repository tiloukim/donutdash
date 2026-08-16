'use client'

import { useState, useEffect } from 'react'

// Per-shop grand-opening countdown banner. Renders nothing once the date
// has passed (or if no date is set), so it self-retires at opening.
export default function OpeningCountdown({ date }: { date?: string | null }) {
  const target = date ? new Date(date).getTime() : NaN
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    if (!Number.isFinite(target)) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [target])

  if (!Number.isFinite(target)) return null
  // Hide once the opening moment has passed.
  if (now !== null && target - now < 0) return null

  const ms = now === null ? 0 : Math.max(0, target - now)
  const parts: [string, number][] = [
    ['Days', Math.floor(ms / 86400000)],
    ['Hours', Math.floor((ms % 86400000) / 3600000)],
    ['Minutes', Math.floor((ms % 3600000) / 60000)],
    ['Seconds', Math.floor((ms % 60000) / 1000)],
  ]

  const label = new Date(date as string).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  })

  return (
    <div style={{
      background: 'linear-gradient(135deg, #FF1493 0%, #FF69B4 100%)',
      color: 'white',
      padding: '1.1rem 1.5rem',
      textAlign: 'center',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ fontSize: 'clamp(1rem, 2.4vw, 1.3rem)', fontWeight: 800, marginBottom: 10 }}>
          🎉 Grand Opening — {label}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {parts.map(([unit, value]) => (
            <div key={unit} style={{
              background: 'rgba(255,255,255,0.18)',
              borderRadius: 12,
              padding: '8px 12px',
              minWidth: 64,
            }}>
              <div style={{ fontSize: 'clamp(1.3rem, 3vw, 1.9rem)', fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {now === null ? '--' : String(value).padStart(2, '0')}
              </div>
              <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9, marginTop: 4 }}>
                {unit}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
