import { NextRequest, NextResponse } from 'next/server'
import { getIvrSettings, IvrSettings } from '@/lib/ivr-settings'

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

function texml(content: string) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${content}</Response>`,
    { headers: { 'Content-Type': 'application/xml' } }
  )
}

// Connect the caller to the live forward number. Plays a department-specific
// greeting, dials FORWARD_NUMBER, and rolls into voicemail if no one answers
// or the office is closed.
async function dialExtension(connectingMessage: string, closedMessage: string) {
  const settings = await getIvrSettings()
  const hoursLine = `Our support hours are ${formatHour(settings.business_hours_start)} to ${formatHour(settings.business_hours_end)} Central Time, 7 days a week.`

  if (!isBusinessHours(settings)) {
    return texml(`
      <Say voice="Azure.en-US-JennyNeural" language="en-US">
        ${closedMessage}
        ${hoursLine}
        Please leave a message after the beep. When you're done, press the pound key to send.
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
    <Say voice="Azure.en-US-JennyNeural" language="en-US">
      ${connectingMessage} This call may be recorded for quality purposes.
    </Say>
    <Dial callerId="+14309990168" timeout="${settings.dial_timeout_seconds}">
      <Number>${settings.forward_number}</Number>
    </Dial>
    <Say voice="Azure.en-US-JennyNeural" language="en-US">
      We're sorry, no one is available to take your call right now.
      Please leave a message after the beep. When you're done, press the pound key to send.
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
  const V = 'Azure.en-US-JennyNeural'

  // Split into multiple short <Say> blocks. Single very-long Say payloads
  // were causing Azure TTS to glitch mid-prompt; one sentence per Say with
  // brief pauses keeps the synthesizer happy.
  const closedLine = !open
    ? `<Say voice="${V}" language="en-US">Our office is currently closed, but you can still check your order status or leave a message.</Say><Pause length="1"/>`
    : ''

  return texml(
    [
      `<Gather action="https://donutdash.app/api/telnyx/voice" method="POST" numDigits="1" timeout="6">`,
      `<Say voice="${V}" language="en-US">Thank you for calling DonutDash, delicious donuts delivered fast!</Say>`,
      `<Pause length="1"/>`,
      closedLine,
      `<Say voice="${V}" language="en-US">Please listen to the following options.</Say>`,
      `<Pause length="1"/>`,
      `<Say voice="${V}" language="en-US">For order status, press 1.</Say>`,
      `<Say voice="${V}" language="en-US">For customer support, press 2.</Say>`,
      `<Say voice="${V}" language="en-US">For driver support, press 3.</Say>`,
      `<Say voice="${V}" language="en-US">To partner your donut shop with DonutDash, press 4.</Say>`,
      `<Say voice="${V}" language="en-US">To speak with a representative, press 0.</Say>`,
      `<Pause length="1"/>`,
      `<Say voice="${V}" language="en-US">Or visit us online at donut dash dot app.</Say>`,
      `</Gather>`,
      `<Say voice="${V}" language="en-US">We didn't receive your selection. Goodbye!</Say>`,
      `<Hangup/>`,
    ].join('')
  )
}

async function handleMenuSelection(digit: string) {
  switch (digit) {
    case '1':
      // Order status — self-service lookup, no extension forwarding
      return texml(`
        <Gather action="https://donutdash.app/api/telnyx/voice/order-status" method="POST" numDigits="8" timeout="10">
          <Say voice="Azure.en-US-JennyNeural" language="en-US">
            To check your order status, please enter the first 8 digits of your order number, followed by the pound key.
            You can find your order number in your confirmation email or text message.
          </Say>
        </Gather>
        <Say voice="Azure.en-US-JennyNeural" language="en-US">We didn't receive your order number. Returning to the main menu.</Say>
        <Redirect method="POST">https://donutdash.app/api/telnyx/voice</Redirect>
      `)

    case '2':
      // Customer support → dial extension
      return dialExtension(
        'Connecting you to customer support, please hold.',
        'You\'ve reached customer support, but our office is currently closed.',
      )

    case '3':
      // Driver support → dial extension
      return dialExtension(
        'Connecting you to driver support, please hold.',
        'You\'ve reached driver support, but our office is currently closed.',
      )

    case '4':
      // Shop partnership → dial extension
      return dialExtension(
        'Connecting you to shop partnerships, please hold.',
        'You\'ve reached shop partnerships, but our office is currently closed.',
      )

    case '0':
      // General representative → dial extension
      return dialExtension(
        'Please hold while we connect you to a representative.',
        'Our office is currently closed.',
      )

    case '9':
      // Return to main menu
      return await mainMenu()

    default:
      return texml(`
        <Say voice="Azure.en-US-JennyNeural" language="en-US">Invalid selection. Please try again.</Say>
        <Redirect method="POST">https://donutdash.app/api/telnyx/voice</Redirect>
      `)
  }
}

export async function GET() {
  return await mainMenu()
}
