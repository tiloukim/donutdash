import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/client-ip'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { phone } = await req.json()
  if (!phone?.trim()) {
    return NextResponse.json({ error: 'Phone number is required.' }, { status: 400 })
  }

  // SMS-pump defense. Twilio charges per send — without these caps,
  // someone can burn the Verify quota and bombard a victim's phone.
  const ip = getClientIp(req.headers)
  const normalizedPhone = phone.trim()
  const ipLimit = await checkRateLimit(`verify-send:ip:${ip}`, 10, 15 * 60_000)
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: 'Too many verification requests. Try again in 15 minutes.' }, { status: 429 })
  }
  const phoneLimit = await checkRateLimit(`verify-send:phone:${normalizedPhone}`, 3, 60 * 60_000)
  if (!phoneLimit.allowed) {
    return NextResponse.json({ error: 'Too many codes sent to this number. Try again in an hour.' }, { status: 429 })
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID

  if (!accountSid || !authToken || !serviceSid) {
    return NextResponse.json({ error: 'Verification not configured.' }, { status: 500 })
  }

  try {
    const url = `https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`
    const params = new URLSearchParams({
      To: phone.trim(),
      Channel: 'sms',
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
      console.error('Verify send error:', data)
      return NextResponse.json({ error: data.message || 'Failed to send code.' }, { status: 400 })
    }
    return NextResponse.json({ success: true, status: data.status })
  } catch (err) {
    console.error('Verify send error:', err)
    return NextResponse.json({ error: 'Failed to send verification code.' }, { status: 500 })
  }
}
