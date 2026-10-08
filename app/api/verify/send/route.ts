import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { normalizePhone } from '@/lib/phone'
import { getClientIp } from '@/lib/client-ip'
import { sendVerificationCode } from '@/lib/phone-verify'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { phone, channel } = await req.json()
  if (!phone?.trim()) {
    return NextResponse.json({ error: 'Phone number is required.' }, { status: 400 })
  }
  // Fallback for when the SMS never arrives: a voice call that reads the code
  // aloud. Anything other than an explicit 'call' stays on SMS.
  const verifyChannel = channel === 'call' ? 'call' : 'sms'

  // SMS-pump defense. Twilio charges per send — without these caps,
  // someone can burn the Verify quota and bombard a victim's phone.
  const ip = getClientIp(req.headers)
  // Normalised for the rate-limit KEY, not just trimmed.
  //
  // It was phone.trim(), so "+19035551212", "9035551212" and
  // "(903) 555-1212" each got their own bucket — the per-number cap that is
  // supposed to stop one phone being bombarded could be lapped simply by
  // changing the punctuation between sends.
  const normalizedPhone = normalizePhone(phone) ?? phone.trim()
  const ipLimit = await checkRateLimit(`verify-send:ip:${ip}`, 10, 15 * 60_000)
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: 'Too many verification requests. Try again in 15 minutes.' }, { status: 429 })
  }
  // Separate per-channel buckets so someone who exhausted SMS attempts can
  // still fall back to a voice call (and vice-versa).
  const phoneLimit = await checkRateLimit(`verify-send:phone:${verifyChannel}:${normalizedPhone}`, 3, 60 * 60_000)
  if (!phoneLimit.allowed) {
    return NextResponse.json({ error: `Too many ${verifyChannel === 'call' ? 'calls' : 'codes'} sent to this number. Try again in an hour.` }, { status: 429 })
  }

  // The provider decision lives in lib/phone-verify: Twilio Verify, falling
  // back to a code we issue over Telnyx. Keeping it there rather than here is
  // what lets the rewards balance route share exactly the same behaviour —
  // a fallback only some callers know about is worse than none.
  const result = await sendVerificationCode(normalizedPhone, verifyChannel)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ success: true, via: result.via })
}
