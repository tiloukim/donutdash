'use client'

/**
 * Public DonutDash Cash balance check.
 *
 * No login: a customer who earned at the counter has never signed up for
 * anything, so an account would be a wall in front of their own money. They
 * prove the number is theirs with a texted code instead.
 *
 * This page replaced a points-and-tiers view (bronze/silver/gold) that needed
 * a login and described a programme DonutDash no longer runs — points were
 * converted to DonutDash Cash at 1 point = 1 cent. Leaving it up would have
 * been the same mistake as a diagnostics screen reporting hardware that is not
 * there: confidently describing something untrue.
 */

import { useState } from 'react'
import Navbar from '@/components/Navbar'
import Link from 'next/link'

interface ShopBalance {
  shop_name: string
  city: string | null
  state: string | null
  balance_cents: number
  lifetime_earned_cents: number
  lifetime_redeemed_cents: number
}

const money = (c: number) => `$${(c / 100).toFixed(2)}`

export default function RewardsPage() {
  const [step, setStep] = useState<'phone' | 'code' | 'done'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ found: boolean; first_name: string | null; shops: ShopBalance[] } | null>(null)

  // Display as (903) 555-1234 while keeping only digits in state, so the
  // request always carries something the server can normalise.
  const digits = phone.replace(/\D/g, '').slice(0, 10)
  const pretty =
    digits.length > 6 ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    : digits.length > 3 ? `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    : digits

  async function sendCode() {
    if (digits.length !== 10) { setError('Enter a 10-digit mobile number.'); return }
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/verify/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: `+1${digits}` }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'Could not send a code.'); return }
      setStep('code')
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function checkBalance() {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/rewards/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: digits, code }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'Could not check that.'); return }
      setResult(data)
      setStep('done')
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const total = (result?.shops ?? []).reduce((s, x) => s + x.balance_cents, 0)

  return (
    <>
      <Navbar />
      <main style={{ maxWidth: 560, margin: '0 auto', padding: '32px 20px 64px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>DonutDash Cash</h1>
        <p style={{ fontSize: 14, color: '#666', marginTop: 0, marginBottom: 28 }}>
          Check what you&rsquo;ve earned. Enter your mobile number and we&rsquo;ll text you a code.
        </p>

        {step === 'phone' && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #FFE4EF', padding: 24 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#555', display: 'block', marginBottom: 6 }}>
              Mobile number
            </label>
            <input
              inputMode="numeric"
              autoComplete="tel"
              value={pretty}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void sendCode() }}
              placeholder="(903) 555-1234"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #FFE4EF', fontSize: 18, letterSpacing: 0.5 }}
            />
            {error && <p style={{ color: '#DC2626', fontSize: 13, marginBottom: 0 }}>{error}</p>}
            <button
              onClick={() => void sendCode()}
              disabled={busy || digits.length !== 10}
              style={{ marginTop: 16, width: '100%', padding: '13px', borderRadius: 8, fontSize: 15, fontWeight: 700, background: digits.length === 10 ? '#FF1493' : '#F3C6DA', color: '#fff', border: 'none', cursor: digits.length === 10 ? 'pointer' : 'default' }}
            >
              {busy ? 'Sending…' : 'Text me a code'}
            </button>
          </div>
        )}

        {step === 'code' && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #FFE4EF', padding: 24 }}>
            <p style={{ fontSize: 14, color: '#444', marginTop: 0 }}>
              We texted a code to <strong>{pretty}</strong>.
            </p>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
              onKeyDown={(e) => { if (e.key === 'Enter') void checkBalance() }}
              placeholder="123456"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #FFE4EF', fontSize: 22, letterSpacing: 6, textAlign: 'center' }}
            />
            {error && <p style={{ color: '#DC2626', fontSize: 13, marginBottom: 0 }}>{error}</p>}
            <button
              onClick={() => void checkBalance()}
              disabled={busy || code.length < 4}
              style={{ marginTop: 16, width: '100%', padding: '13px', borderRadius: 8, fontSize: 15, fontWeight: 700, background: code.length >= 4 ? '#FF1493' : '#F3C6DA', color: '#fff', border: 'none', cursor: code.length >= 4 ? 'pointer' : 'default' }}
            >
              {busy ? 'Checking…' : 'Check my balance'}
            </button>
            <button
              onClick={() => { setStep('phone'); setCode(''); setError('') }}
              style={{ marginTop: 10, width: '100%', padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'transparent', color: '#888', border: 'none', cursor: 'pointer' }}
            >
              Use a different number
            </button>
          </div>
        )}

        {step === 'done' && result && (
          <>
            {result.shops.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #FFE4EF', padding: 28, textAlign: 'center' }}>
                <p style={{ fontSize: 16, fontWeight: 700, marginTop: 0, marginBottom: 6 }}>
                  No DonutDash Cash yet
                </p>
                <p style={{ fontSize: 14, color: '#666', marginTop: 0 }}>
                  {result.found
                    ? 'You haven’t earned any yet. Give your number at the counter on your next order and it starts adding up.'
                    : 'We don’t have this number on file yet. Give it at the counter on your next order and you’ll start earning.'}
                </p>
                <Link href="/shops" style={{ display: 'inline-block', marginTop: 14, padding: '11px 22px', borderRadius: 8, background: '#FF1493', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
                  Find a shop
                </Link>
              </div>
            ) : (
              <>
                <div style={{ background: 'linear-gradient(135deg,#FF1493,#FF6FB5)', borderRadius: 14, padding: 26, color: '#fff', marginBottom: 18 }}>
                  <p style={{ margin: 0, fontSize: 13, opacity: 0.9, fontWeight: 600 }}>
                    {result.first_name ? `${result.first_name}, you have` : 'You have'}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>{money(total)}</p>
                  <p style={{ margin: '6px 0 0', fontSize: 13, opacity: 0.9 }}>
                    {result.shops.length === 1
                      ? 'at 1 shop'
                      : `across ${result.shops.length} shops`}
                  </p>
                </div>

                {/* Per shop, and said out loud: this is the rule that decides
                    where the money can be spent, so it belongs on the screen
                    rather than in a surprise at the till. */}
                <p style={{ fontSize: 12, color: '#888', marginTop: 0, marginBottom: 12 }}>
                  DonutDash Cash is earned and spent at the same shop. Each balance below can only
                  be used at that shop.
                </p>

                {result.shops.map((s, i) => (
                  <div key={i} style={{ background: '#fff', borderRadius: 12, border: '1px solid #FFE4EF', padding: 18, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{s.shop_name}</p>
                      {(s.city || s.state) && (
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#999' }}>
                          {[s.city, s.state].filter(Boolean).join(', ')}
                        </p>
                      )}
                      <p style={{ margin: '6px 0 0', fontSize: 11, color: '#aaa' }}>
                        Earned {money(s.lifetime_earned_cents)} &middot; used {money(s.lifetime_redeemed_cents)}
                      </p>
                    </div>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#FF1493', fontVariantNumeric: 'tabular-nums' }}>
                      {money(s.balance_cents)}
                    </p>
                  </div>
                ))}
              </>
            )}
            <button
              onClick={() => { setStep('phone'); setCode(''); setResult(null); setError('') }}
              style={{ marginTop: 16, width: '100%', padding: '11px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'transparent', color: '#888', border: '1px solid #FFE4EF', cursor: 'pointer' }}
            >
              Check another number
            </button>
          </>
        )}
      </main>
    </>
  )
}
