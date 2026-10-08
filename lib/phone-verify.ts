import crypto from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/phone'
import { sendSMS } from '@/lib/sms'

/**
 * Phone verification: Twilio Verify, falling back to a code we issue over
 * Telnyx.
 *
 * Twilio Verify normally does all of this — generate, store, expire, check.
 * When it is unavailable none of that exists, and on 8 Oct 2026 that took
 * signup, shop-owner auth and the rewards balance check down together while
 * order alerts kept flowing, because lib/sms.ts already tries Telnyx first and
 * only verification called Twilio with no alternative.
 *
 * One module rather than three copies: the send path, the check path and the
 * rewards balance route all need the same decision, and a fallback that only
 * two of them know about is worse than no fallback at all.
 */

const CODE_TTL_MS = 10 * 60_000
const MAX_ATTEMPTS = 5

function hashCode(phone: string, code: string): string {
  // Salted with the phone number so one precomputed table cannot cover every
  // six-digit code.
  return crypto.createHash('sha256').update(`${phone}:${code}`).digest('hex')
}

function sixDigits(): string {
  // randomInt is uniform and CSPRNG-backed. Math.random() is neither, and this
  // is a credential.
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
}

function twilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID
  if (!accountSid || !authToken || !serviceSid) return null
  return { accountSid, authToken, serviceSid }
}

function basic(accountSid: string, authToken: string) {
  return 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')
}

export type SendResult =
  | { ok: true; via: 'twilio' | 'telnyx' }
  | { ok: false; error: string }

/**
 * Send a verification code.
 *
 * `channel` is only meaningful on Twilio — the fallback is SMS, because a
 * voice call needs a TTS leg Telnyx is not configured for here. A caller
 * asking for a call still gets a code; it arrives as a text.
 */
export async function sendVerificationCode(
  rawPhone: string,
  channel: 'sms' | 'call' = 'sms',
): Promise<SendResult> {
  const phone = normalizePhone(rawPhone)
  if (!phone) return { ok: false, error: 'Enter a 10-digit mobile number.' }
  const e164 = `+1${phone}`

  const cfg = twilioConfig()
  if (cfg) {
    try {
      const res = await fetch(
        `https://verify.twilio.com/v2/Services/${cfg.serviceSid}/Verifications`,
        {
          method: 'POST',
          headers: { Authorization: basic(cfg.accountSid, cfg.authToken),
                     'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ To: e164, Channel: channel }),
        },
      )
      if (res.ok) return { ok: true, via: 'twilio' }
      // Logged, never forwarded: these messages are written for the account
      // operator and can name the account.
      console.error('[verify] Twilio send failed, falling back to Telnyx:', await res.text().catch(() => ''))
    } catch (e) {
      console.error('[verify] Twilio send threw, falling back to Telnyx:', e)
    }
  } else {
    console.warn('[verify] Twilio not configured; using Telnyx')
  }

  // ── Fallback: our own code, over Telnyx ──
  const code = sixDigits()
  const svc = createServiceClient()
  const { error: insErr } = await svc.from('dd_phone_verifications').insert({
    phone_normalized: phone,
    code_hash: hashCode(phone, code),
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  })
  if (insErr) {
    console.error('[verify] could not store fallback code:', insErr.message)
    return { ok: false, error: 'We could not send a code right now. Please try again shortly.' }
  }

  const sent = await sendSMS(e164, `${code} is your DonutDash verification code. It expires in 10 minutes.`)
  if (!sent) {
    return { ok: false, error: 'We could not send a code right now. Please try again shortly.' }
  }
  return { ok: true, via: 'telnyx' }
}

export type CheckResult = { verified: boolean; error?: string }

/**
 * Check a code against whichever system issued it.
 *
 * The local store is consulted FIRST. It only ever holds rows written by the
 * fallback, so a live row means Twilio was down when this code was sent and
 * Twilio has never heard of it — asking Twilio first would return "not found"
 * and reject a code that is perfectly valid.
 */
export async function checkVerificationCode(
  rawPhone: string,
  rawCode: string,
): Promise<CheckResult> {
  const phone = normalizePhone(rawPhone)
  const code = String(rawCode ?? '').trim()
  if (!phone) return { verified: false, error: 'Enter a 10-digit mobile number.' }
  if (!/^\d{4,10}$/.test(code)) return { verified: false, error: 'Enter the code we sent you.' }

  const svc = createServiceClient()
  const { data: rows } = await svc
    .from('dd_phone_verifications')
    .select('id, code_hash, expires_at, attempts, consumed_at')
    .eq('phone_normalized', phone)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)

  const row = rows?.[0]
  if (row) {
    if (row.attempts >= MAX_ATTEMPTS) {
      return { verified: false, error: 'Too many tries. Request a new code.' }
    }
    const expected = row.code_hash
    const given = hashCode(phone, code)
    // Both are fixed-length hex of our own making, so timingSafeEqual cannot
    // throw on a length mismatch the way it would on raw user input.
    const match = crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(given, 'hex'))
    if (!match) {
      await svc.from('dd_phone_verifications')
        .update({ attempts: row.attempts + 1 }).eq('id', row.id)
      return { verified: false, error: 'That code is not right. Try again.' }
    }
    // Spend it. A code is good exactly once.
    await svc.from('dd_phone_verifications')
      .update({ consumed_at: new Date().toISOString() }).eq('id', row.id)
    return { verified: true }
  }

  const cfg = twilioConfig()
  if (!cfg) return { verified: false, error: 'Verification is not available right now.' }
  try {
    const res = await fetch(
      `https://verify.twilio.com/v2/Services/${cfg.serviceSid}/VerificationCheck`,
      {
        method: 'POST',
        headers: { Authorization: basic(cfg.accountSid, cfg.authToken),
                   'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ To: `+1${phone}`, Code: code }),
      },
    )
    const data = await res.json()
    if (res.ok && data.status === 'approved') return { verified: true }
    if (!res.ok) console.error('[verify] Twilio check failed:', data)
    return { verified: false, error: 'That code is not right. Try again.' }
  } catch (e) {
    console.error('[verify] Twilio check threw:', e)
    return { verified: false, error: 'Could not check that code. Try again.' }
  }
}
