/**
 * Validation for timestamps a REGISTER supplies, rather than the server
 * generating them.
 *
 * Needed because a replayed offline mutation has to carry the time the thing
 * actually happened. `clock_in` and `opened_at` default to now(), and on
 * replay now() is the moment the internet returned — which would silently
 * mis-date payroll and, worse, move a drawer session's opening time past the
 * sales it is supposed to account for (expected_cash is computed from sales
 * since opened_at, so every sale rung during the outage would drop out of the
 * window and the whole day would read as an overage).
 *
 * A client-supplied time is still a client-supplied value, so it is bounded:
 * never in the future beyond a little clock skew, never older than the queue
 * could plausibly hold. Outside those bounds we fall back to the server's own
 * clock rather than rejecting the whole request — refusing would mean losing
 * a real shift or a real drawer close over a wrong device clock, which is a
 * worse outcome than a slightly wrong timestamp.
 */

/** Registers run on tablet clocks; a little skew is normal. */
const FUTURE_SKEW_MS = 5 * 60 * 1000
/** Matches the offline queue's own retention horizon. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

export interface ClientTime {
  /** The timestamp to persist. */
  iso: string
  /** True when the supplied value was used; false when it was replaced. */
  accepted: boolean
  /** Why it was rejected, for the response so a device can be diagnosed. */
  reason?: 'malformed' | 'future' | 'too_old'
}

export function resolveClientTime(supplied: unknown, now = Date.now()): ClientTime {
  if (supplied == null) return { iso: new Date(now).toISOString(), accepted: false }
  if (typeof supplied !== 'string') {
    return { iso: new Date(now).toISOString(), accepted: false, reason: 'malformed' }
  }
  const t = Date.parse(supplied)
  if (!Number.isFinite(t)) {
    return { iso: new Date(now).toISOString(), accepted: false, reason: 'malformed' }
  }
  if (t > now + FUTURE_SKEW_MS) {
    return { iso: new Date(now).toISOString(), accepted: false, reason: 'future' }
  }
  if (t < now - MAX_AGE_MS) {
    return { iso: new Date(now).toISOString(), accepted: false, reason: 'too_old' }
  }
  return { iso: new Date(t).toISOString(), accepted: true }
}

/** Idempotency keys come from a device; keep them bounded and printable. */
export function normalizeClientKey(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (!s || s.length > 120) return null
  return /^[A-Za-z0-9._:-]+$/.test(s) ? s : null
}
