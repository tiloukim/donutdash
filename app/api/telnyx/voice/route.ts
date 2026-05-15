import { NextRequest, NextResponse } from 'next/server'
import { getIvrSettings, IvrSettings, forwardFor } from '@/lib/ivr-settings'

function isBusinessHours(settings: IvrSettings): boolean {
  const now = new Date()
  const ct = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }))
  const hour = ct.getHours()
  return hour >= settings.business_hours_start && hour < settings.business_hours_end
}

function formatHour(h: number): string {
  if (h === 0) return '12 AM'
  if (h < 12) return `${h} AM`
  if (h === 12) return '12 PM'
  return `${h - 12} PM`
}

// Escape values inserted into TeXML so user-edited prompt text can't break
// the XML if it contains <, >, &, or quotes.
function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function texml(content: string) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${content}</Response>`,
    { headers: { 'Content-Type': 'application/xml' } }
  )
}

// Connect the caller to the live forward number. Plays a department-specific
// greeting, dials FORWARD_NUMBER, and rolls into voicemail if no one answers
// or the office is closed.
function optionLabel(settings: IvrSettings, digit: '0' | '2' | '3' | '4'): string {
  const key = `option_label_${digit}` as keyof IvrSettings
  return (settings[key] as string) || ''
}

async function dialExtension(digit: '0' | '2' | '3' | '4') {
  const settings = await getIvrSettings()
  const V = settings.tts_voice
  const hoursLine = `Our support hours are ${formatHour(settings.business_hours_start)} to ${formatHour(settings.business_hours_end)} Central Time, 7 days a week.`
  const number = forwardFor(settings, digit)
  const label = xmlEscape(optionLabel(settings, digit))
  const vm = xmlEscape(settings.voicemail_prompt)

  if (!isBusinessHours(settings)) {
    return texml(`
      <Say voice="${V}" language="en-US">
        You've reached ${label}, but our office is currently closed.
        ${hoursLine}
        ${vm}
      </Say>
      <Record
        maxLength="120"
        playBeep="true"
        finishOnKey="#"
        action="https://donutdash.app/api/telnyx/voice/voicemail"
        method="POST"
        recordingStatusCallback="https://donutdash.app/api/telnyx/voice/voicemail"
        recordingStatusCallbackMethod="POST"
      />
      <Hangup/>
    `)
  }

  return texml(`
    <Say voice="${V}" language="en-US">
      Connecting you to ${label}, please hold. This call may be recorded for quality purposes.
    </Say>
    <Dial callerId="+14309990168" timeout="${settings.dial_timeout_seconds}">
      <Number>${number}</Number>
    </Dial>
    <Say voice="${V}" language="en-US">
      We're sorry, no one is available to take your call right now.
      ${vm}
    </Say>
    <Record
      maxLength="120"
      playBeep="true"
      finishOnKey="#"
      action="https://donutdash.app/api/telnyx/voice/voicemail"
      method="POST"
      recordingStatusCallback="https://donutdash.app/api/telnyx/voice/voicemail"
      recordingStatusCallbackMethod="POST"
    />
    <Hangup/>
  `)
}

// Main IVR handler — Telnyx sends POST when a call comes in
export async function POST(req: NextRequest) {
  const body = await req.formData().catch(() => null)
  const params = body ? Object.fromEntries(body.entries()) : await req.json().catch(() => ({}))

  // Check for digit press (DTMF)
  const digits = params.Digits || params.digits || ''

  // If digits were pressed, handle menu selection
  if (digits) {
    return await handleMenuSelection(digits.toString())
  }

  // Main menu
  return await mainMenu()
}

async function mainMenu() {
  const settings = await getIvrSettings()
  const open = isBusinessHours(settings)
  const V = settings.tts_voice

  const greeting = xmlEscape(settings.greeting)
  const l0 = xmlEscape(optionLabel(settings, '0'))
  const l2 = xmlEscape(optionLabel(settings, '2'))
  const l3 = xmlEscape(optionLabel(settings, '3'))
  const l4 = xmlEscape(optionLabel(settings, '4'))

  const closedLine = !open
    ? `<Say voice="${V}" language="en-US">Our office is currently closed, but you can still check your order status or leave a message.</Say><Pause length="1"/>`
    : ''

  return texml(
    [
      `<Gather action="https://donutdash.app/api/telnyx/voice" method="POST" numDigits="1" timeout="6">`,
      `<Say voice="${V}" language="en-US">${greeting}</Say>`,
      `<Pause length="1"/>`,
      closedLine,
      `<Say voice="${V}" language="en-US">Please listen to the following options.</Say>`,
      `<Pause length="1"/>`,
      `<Say voice="${V}" language="en-US">For order status, press 1.</Say>`,
      `<Say voice="${V}" language="en-US">For ${l2}, press 2.</Say>`,
      `<Say voice="${V}" language="en-US">For ${l3}, press 3.</Say>`,
      `<Say voice="${V}" language="en-US">To ${l4}, press 4.</Say>`,
      `<Say voice="${V}" language="en-US">To speak with ${l0}, press 0.</Say>`,
      `<Pause length="1"/>`,
      `<Say voice="${V}" language="en-US">Or visit us online at donut dash dot app.</Say>`,
      `</Gather>`,
      `<Say voice="${V}" language="en-US">We didn't receive your selection. Goodbye!</Say>`,
      `<Hangup/>`,
    ].join('')
  )
}

async function handleMenuSelection(digit: string) {
  const settings = await getIvrSettings()
  const V = settings.tts_voice

  switch (digit) {
    case '1':
      // Order status — self-service lookup, no extension forwarding
      return texml(`
        <Gather action="https://donutdash.app/api/telnyx/voice/order-status" method="POST" numDigits="8" timeout="10">
          <Say voice="${V}" language="en-US">
            To check your order status, please enter the first 8 digits of your order number, followed by the pound key.
            You can find your order number in your confirmation email or text message.
          </Say>
        </Gather>
        <Say voice="${V}" language="en-US">We didn't receive your order number. Returning to the main menu.</Say>
        <Redirect method="POST">https://donutdash.app/api/telnyx/voice</Redirect>
      `)

    case '2': return dialExtension('2')
    case '3': return dialExtension('3')
    case '4': return dialExtension('4')
    case '0': return dialExtension('0')

    case '9':
      // Return to main menu
      return await mainMenu()

    default:
      return texml(`
        <Say voice="${V}" language="en-US">Invalid selection. Please try again.</Say>
        <Redirect method="POST">https://donutdash.app/api/telnyx/voice</Redirect>
      `)
  }
}

export async function GET() {
  return await mainMenu()
}
