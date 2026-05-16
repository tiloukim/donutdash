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

  console.log('[voicemail webhook] received params:', JSON.stringify(params))

  // Extension dialed (if any) is in the URL query string — appended in
  // dialExtensionDirect() so we can route the SMS notification.
  const url = new URL(req.url)
  const forExtension = (url.searchParams.get('ext') || '').trim() || null

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

  // Look up extension owner so we can SMS the right person + label the row.
  let extOwnerPhone: string | null = null
  let extOwnerName: string | null = null
  if (forExtension) {
    try {
      const svc = createServiceClient()
      const { data: ext } = await svc
        .from('dd_ivr_extensions')
        .select('name, phone_number')
        .eq('extension', forExtension)
        .maybeSingle()
      if (ext) {
        extOwnerPhone = ext.phone_number
        extOwnerName = ext.name
      }
    } catch (e) {
      console.error('[voicemail webhook] extension lookup failed:', e)
    }
  }

  // Dedupe by call_sid (Telnyx fires action + recordingStatusCallback).
  try {
    const svc = createServiceClient()

    if (callSid) {
      const { data: existing } = await svc
        .from('dd_voicemails')
        .select('id, recording_url, duration_seconds, for_extension')
        .eq('call_sid', callSid)
        .maybeSingle()

      if (existing) {
        const updates: Record<string, unknown> = {}
        if (recordingUrl && existing.recording_url !== recordingUrl) updates.recording_url = recordingUrl
        const dur = parseInt(duration, 10) || 0
        if (dur > (existing.duration_seconds || 0)) updates.duration_seconds = dur
        if (forExtension && !existing.for_extension) {
          updates.for_extension = forExtension
          if (extOwnerName) updates.for_extension_name = extOwnerName
        }
        if (Object.keys(updates).length > 0) {
          await svc.from('dd_voicemails').update(updates).eq('id', existing.id)
        }
      } else {
        await svc.from('dd_voicemails').insert({
          call_sid: callSid,
          caller_number: callerNumber,
          recording_url: recordingUrl || 'pending',
          duration_seconds: parseInt(duration, 10) || 0,
          for_extension: forExtension,
          for_extension_name: extOwnerName,
        })
      }
    } else {
      await svc.from('dd_voicemails').insert({
        caller_number: callerNumber,
        recording_url: recordingUrl || 'pending',
        duration_seconds: parseInt(duration, 10) || 0,
        for_extension: forExtension,
        for_extension_name: extOwnerName,
      })
    }
  } catch (e) {
    console.error('[voicemail webhook] persist threw:', e)
  }

  // Build SMS + email recipients. Extension owner gets the SMS if the call
  // was for an extension; admin is always copied via email as backup.
  const adminPhone = process.env.IVR_FORWARD_NUMBER || process.env.ADMIN_PHONE_NUMBERS?.split(',')[0]
  const adminEmail = process.env.ADMIN_EMAILS?.split(',')[0]
  const targetPhone = extOwnerPhone || adminPhone

  const forLine = forExtension
    ? `For: ext ${forExtension}${extOwnerName ? ` (${extOwnerName})` : ''}\n`
    : ''
  const smsMessage = `New DonutDash voicemail\n${forLine}From: ${callerNumber} (${duration}s)\n${recordingUrl ? `Listen: ${recordingUrl}` : 'Recording processing…'}`

  if (targetPhone) {
    try { await sendSMS(targetPhone, smsMessage) }
    catch (e) { console.error('[voicemail webhook] sms failed:', e) }
  }

  if (adminEmail) {
    const subject = forExtension
      ? `New Voicemail for ext ${forExtension}${extOwnerName ? ` (${extOwnerName})` : ''} from ${callerNumber}`
      : `New Voicemail from ${callerNumber}`
    await sendEmail(
      adminEmail,
      subject,
      `<div style="font-family:sans-serif;padding:20px;">
        <h2 style="color:#FF8C00;">DonutDash Voicemail</h2>
        ${forExtension ? `<p><strong>For:</strong> Extension ${forExtension}${extOwnerName ? ` (${extOwnerName})` : ''}</p>` : ''}
        <p><strong>From:</strong> ${callerNumber}</p>
        <p><strong>Duration:</strong> ${duration} seconds</p>
        ${recordingUrl ? `<p><strong>Recording:</strong> <a href="${recordingUrl}">Listen</a></p>` : ''}
        <p style="margin-top:16px;"><a href="https://donutdash.app/admin/voicemails" style="background:#6366F1;color:#fff;padding:8px 16px;border-radius:8px;text-decoration:none;font-weight:600;">Open Voicemails Admin</a></p>
      </div>`
    ).catch((e: unknown) => console.error('[voicemail webhook] email failed:', e))
  }

  return texml(`
    <Say voice="Azure.en-US-JennyNeural" language="en-US">
      Thank you for your message. We'll get back to you as soon as possible. Goodbye!
    </Say>
    <Hangup/>
  `)
}
