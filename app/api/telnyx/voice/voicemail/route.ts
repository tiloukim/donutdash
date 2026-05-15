import { NextRequest, NextResponse } from 'next/server'
import { sendSMS, sendEmail } from '@/lib/sms'
import { createServiceClient } from '@/lib/supabase/server'

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

  // Persist to /admin/voicemails archive (best-effort)
  try {
    if (recordingUrl) {
      const svc = createServiceClient()
      await svc.from('dd_voicemails').insert({
        caller_number: callerNumber.toString(),
        recording_url: recordingUrl.toString(),
        duration_seconds: parseInt(duration.toString(), 10) || 0,
      })
    }
  } catch (e) {
    console.error('Failed to persist voicemail:', e)
  }

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
        <p style="margin-top:16px;"><a href="https://donutdash.app/admin/voicemails" style="background:#6366F1;color:#fff;padding:8px 16px;border-radius:8px;text-decoration:none;font-weight:600;">Open Voicemails Admin</a></p>
      </div>`
    )
  }

  return texml(`
    <Say voice="Azure.en-US-JennyNeural" language="en-US">
      Thank you for your message. We'll get back to you as soon as possible. Goodbye!
    </Say>
    <Hangup/>
  `)
}
