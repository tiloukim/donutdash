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
  const params: Record<string, unknown> = body
    ? Object.fromEntries(body.entries())
    : await req.json().catch(() => ({}))

  // Log everything so we can see exactly what Telnyx sends. Check Vercel logs
  // under /api/telnyx/voice/voicemail right after a test voicemail.
  console.log('[voicemail webhook] received params:', JSON.stringify(params))

  // Telnyx TeXML uses CamelCase (Twilio-compat). Call Control format uses
  // snake_case. Some carriers also send PublicRecordingUrl. Cover all.
  const recordingUrl = (
    params.RecordingUrl ||
    params.recording_url ||
    params.PublicRecordingUrl ||
    params.public_recording_url ||
    ''
  ).toString()
  const callerNumber = (params.From || params.from || params.Caller || params.caller || 'Unknown').toString()
  const duration = (params.RecordingDuration || params.recording_duration || '0').toString()
  const callSid = (params.CallSid || params.call_sid || params.CallControlId || params.call_control_id || '').toString()

  // Telnyx fires BOTH `action` and `recordingStatusCallback` for the same
  // recording — one as the next TeXML step, one as a status notification.
  // Dedupe by call_sid (upsert): a later callback with the real URL/duration
  // overwrites the earlier "pending" row.
  try {
    const svc = createServiceClient()

    if (callSid) {
      const { data: existing } = await svc
        .from('dd_voicemails')
        .select('id, recording_url, duration_seconds')
        .eq('call_sid', callSid)
        .maybeSingle()

      if (existing) {
        // Only update if this callback has better data (real URL or duration)
        const updates: Record<string, unknown> = {}
        if (recordingUrl && existing.recording_url !== recordingUrl) updates.recording_url = recordingUrl
        const dur = parseInt(duration, 10) || 0
        if (dur > (existing.duration_seconds || 0)) updates.duration_seconds = dur
        if (Object.keys(updates).length > 0) {
          await svc.from('dd_voicemails').update(updates).eq('id', existing.id)
          console.log('[voicemail webhook] updated row', existing.id, 'with', Object.keys(updates))
        } else {
          console.log('[voicemail webhook] duplicate call_sid, no new data')
        }
      } else {
        const { error } = await svc.from('dd_voicemails').insert({
          call_sid: callSid,
          caller_number: callerNumber,
          recording_url: recordingUrl || 'pending',
          duration_seconds: parseInt(duration, 10) || 0,
        })
        if (error) console.error('[voicemail webhook] insert error:', error.message)
        else console.log('[voicemail webhook] persisted row for', callerNumber)
      }
    } else {
      // No CallSid → can't dedupe, just insert.
      const { error } = await svc.from('dd_voicemails').insert({
        caller_number: callerNumber,
        recording_url: recordingUrl || 'pending',
        duration_seconds: parseInt(duration, 10) || 0,
      })
      if (error) console.error('[voicemail webhook] insert error:', error.message)
    }
  } catch (e) {
    console.error('[voicemail webhook] persist threw:', e)
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
