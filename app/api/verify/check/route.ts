import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { normalizePhone } from '@/lib/phone'
import { getClientIp } from '@/lib/client-ip'
import { checkVerificationCode } from '@/lib/phone-verify'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { phone, code } = await req.json()
  if (!phone?.trim() || !code?.trim()) {
    return NextResponse.json({ error: 'Phone and code are required.' }, { status: 400 })
  }

  // OTP brute-force defense. 6-digit space is 1M combos; without this
  // an attacker who got a victim into the "code sent" state could try
  // codes as fast as the network allows.
  const ip = getClientIp(req.headers)
  // Normalised for the rate-limit KEY, not just trimmed.
  //
  // It was phone.trim(), so "+19035551212", "9035551212" and
  // "(903) 555-1212" each got their own bucket — the per-number cap that is
  // supposed to stop one phone being bombarded could be lapped simply by
  // changing the punctuation between sends.
  const normalizedPhone = normalizePhone(phone) ?? phone.trim()
  const phoneLimit = await checkRateLimit(`verify-check:phone:${normalizedPhone}`, 20, 60 * 60_000)
  if (!phoneLimit.allowed) {
    return NextResponse.json({ error: 'Too many verification attempts. Try again in an hour.' }, { status: 429 })
  }
  const ipLimit = await checkRateLimit(`verify-check:ip:${ip}`, 50, 60 * 60_000)
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: 'Too many verification attempts. Try again in an hour.' }, { status: 429 })
  }

  // Checks the local fallback store first, then Twilio — see lib/phone-verify
  // for why that order matters.
  const result = await checkVerificationCode(normalizedPhone, code)
  if (result.verified) return NextResponse.json({ verified: true })
  return NextResponse.json({ verified: false, error: result.error ?? 'Invalid code. Please try again.' })
}
