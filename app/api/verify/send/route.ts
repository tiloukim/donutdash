import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { phone } = await req.json()
  if (!phone?.trim()) {
    return NextResponse.json({ error: 'Phone number is required.' }, { status: 400 })
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
