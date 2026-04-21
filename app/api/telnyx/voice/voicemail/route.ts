import { NextRequest, NextResponse } from 'next/server'
import { sendSMS, sendEmail } from '@/lib/sms'

function texml(content: string) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${content}</Response>`,
    { headers: { 'Content-Type': 'application/xml' } }
  )
}

export async function POST(req: NextRequest) {
  const body = await req.formData().catch(() => null)
  const params = body ? Object.fromEntries(body.entries()) : await req.json().catch(() => ({}))

  const recordingUrl = params.RecordingUrl || params.recording_url || ''
  const callerNumber = params.From || params.from || 'Unknown'
  const duration = params.RecordingDuration || params.recording_duration || '0'

  // Notify admin about voicemail
  const message = `New DonutDash voicemail from ${callerNumber} (${duration}s). Recording: ${recordingUrl}`

  const adminPhone = process.env.IVR_FORWARD_NUMBER || process.env.ADMIN_PHONE_NUMBERS?.split(',')[0]
  const adminEmail = process.env.ADMIN_EMAILS?.split(',')[0]

  if (adminPhone) await sendSMS(adminPhone, message)
  if (adminEmail) {
    await sendEmail(
      adminEmail,
      `New Voicemail from ${callerNumber}`,
      `<div style="font-family:sans-serif;padding:20px;">
        <h2 style="color:#FF8C00;">DonutDash Voicemail</h2>
        <p><strong>From:</strong> ${callerNumber}</p>
        <p><strong>Duration:</strong> ${duration} seconds</p>
        ${recordingUrl ? `<p><strong>Recording:</strong> <a href="${recordingUrl}">Listen</a></p>` : ''}
      </div>`
    )
  }

  return texml(`
    <Say voice="Polly.Joanna-Neural" language="en-US">
      Thank you for your message. We'll get back to you as soon as possible. Goodbye!
    </Say>
    <Hangup/>
  `)
}
