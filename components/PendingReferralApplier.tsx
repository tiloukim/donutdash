'use client'

import { useEffect, useRef } from 'react'

// After signup → email confirm → callback redirect, the user lands on
// /driver or /shop already authenticated. If a referral code is sitting in
// localStorage from /r/<code> or ?ref=, apply it to the right endpoint and
// then clear it. Idempotent — backend rejects duplicate apply with 400.
export default function PendingReferralApplier({ kind }: { kind: 'driver' | 'shop' }) {
  const ran = useRef(false)
  useEffect(() => {
    if (ran.current) return
    ran.current = true
    let code = ''
    try { code = localStorage.getItem('dd_ref')?.trim().toUpperCase() || '' } catch {}
    if (!code) return

    const endpoint = kind === 'driver' ? '/api/driver/referral' : '/api/shop/referral'
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referral_code: code }),
    })
      .then(r => r.json().catch(() => ({})).then(body => ({ ok: r.ok, body })))
      .then(({ ok, body }) => {
        // Clear on success or any deterministic failure (already applied,
        // invalid, can't use own code) — anything that won't change on retry.
        // Substrings that indicate the code is permanently un-applicable on this account.
        // Anything else (network blip, transient 500) we leave in storage to retry later.
        const clearableErrors = [
          'already used a referral',
          'Invalid referral code',
          'Cannot use your own',
        ]
        if (ok || (body?.error && clearableErrors.some(e => String(body.error).includes(e)))) {
          try { localStorage.removeItem('dd_ref') } catch {}
        }
      })
      .catch(() => {})
  }, [kind])

  return null
}
