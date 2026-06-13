import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/client-ip'

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
  const normalizedPhone = phone.trim()
  const phoneLimit = await checkRateLimit(`verify-check:phone:${normalizedPhone}`, 20, 60 * 60_000)
  if (!phoneLimit.allowed) {
    return NextResponse.json({ error: 'Too many verification attempts. Try again in an hour.' }, { status: 429 })
  }
  const ipLimit = await checkRateLimit(`verify-check:ip:${ip}`, 50, 60 * 60_000)
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: 'Too many verification attempts. Try again in an hour.' }, { status: 429 })
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID

  if (!accountSid || !authToken || !serviceSid) {
    return NextResponse.json({ error: 'Verification not configured.' }, { status: 500 })
  }

  try {
    const url = `https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`
    const params = new URLSearchParams({
      To: phone.trim(),
      Code: code.trim(),
    })
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })
    const data = await res.json()
    if (!res.ok) {
      console.error('Verify check error:', data)
      return NextResponse.json({ error: data.message || 'Verification failed.' }, { status: 400 })
    }
    if (data.status === 'approved') {
      return NextResponse.json({ verified: true })
    }
    return NextResponse.json({ verified: false, error: 'Invalid code. Please try again.' })
  } catch (err) {
    console.error('Verify check error:', err)
    return NextResponse.json({ error: 'Verification failed.' }, { status: 500 })
  }
}
