import { NextRequest, NextResponse } from 'next/server'

const FORWARD_NUMBER = process.env.IVR_FORWARD_NUMBER || '+19033455599'
const BUSINESS_HOURS_START = 8   // 8 AM CT
const BUSINESS_HOURS_END = 16   // 4 PM CT

function isBusinessHours(): boolean {
  const now = new Date()
  // Convert to Central Time
  const ct = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }))
  const hour = ct.getHours()
  return hour >= BUSINESS_HOURS_START && hour < BUSINESS_HOURS_END
}

function texml(content: string) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${content}</Response>`,
    { headers: { 'Content-Type': 'application/xml' } }
  )
}

// Main IVR handler — Telnyx sends POST when a call comes in
export async function POST(req: NextRequest) {
  const body = await req.formData().catch(() => null)
  const params = body ? Object.fromEntries(body.entries()) : await req.json().catch(() => ({}))

  // Check for digit press (DTMF)
  const digits = params.Digits || params.digits || ''
  const callStatus = params.CallStatus || params.call_status || ''

  // If digits were pressed, handle menu selection
  if (digits) {
    return handleMenuSelection(digits.toString())
  }

  // Main menu
  return mainMenu()
}

function mainMenu() {
  const open = isBusinessHours()

  return texml(`
    <Gather action="https://donutdash.app/api/telnyx/voice" method="POST" numDigits="1" timeout="8">
      <Say voice="Azure.en-US-JennyNeural" language="en-US">
        Thank you for calling DonutDash, delicious donuts delivered fast!
        ${!open ? 'Our office is currently closed, but you can still check your order status.' : ''}
        Please listen to the following options.
        Press 1 to check your order status.
        Press 2 for customer support.
        Press 3 for driver support.
        Press 4 to learn about partnering your donut shop with DonutDash.
        Press 0 to speak with a representative.
        Or visit us online at donut dash dot app.
      </Say>
    </Gather>
    <Say voice="Azure.en-US-JennyNeural" language="en-US">We didn't receive your selection. Goodbye!</Say>
    <Hangup/>
  `)
}

function handleMenuSelection(digit: string) {
  switch (digit) {
    case '1':
      // Order status
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
      // Customer support
      return texml(`
        <Say voice="Azure.en-US-JennyNeural" language="en-US">
          For customer support, you can email us at support at donut dash dot app,
          or visit donut dash dot app slash support.
          To speak with a representative, press 0.
          To return to the main menu, press 9.
        </Say>
        <Gather action="https://donutdash.app/api/telnyx/voice" method="POST" numDigits="1" timeout="5"/>
        <Redirect method="POST">https://donutdash.app/api/telnyx/voice</Redirect>
      `)

    case '3':
      // Driver support
      return texml(`
        <Say voice="Azure.en-US-JennyNeural" language="en-US">
          For driver support, please visit donut dash dot app slash support slash drivers,
          or email driver support at donut dash dot app.
          If you're interested in becoming a DonutDash driver, visit donut dash dot app slash driver to sign up.
          To speak with a representative, press 0.
          To return to the main menu, press 9.
        </Say>
        <Gather action="https://donutdash.app/api/telnyx/voice" method="POST" numDigits="1" timeout="5"/>
        <Redirect method="POST">https://donutdash.app/api/telnyx/voice</Redirect>
      `)

    case '4':
      // Shop partnership
      return texml(`
        <Say voice="Azure.en-US-JennyNeural" language="en-US">
          Thank you for your interest in partnering with DonutDash!
          We help local donut shops reach more customers through online ordering and delivery.
          To get started, visit donut dash dot app slash partner dash setup,
          or email us at partners at donut dash dot app.
          To speak with a representative, press 0.
          To return to the main menu, press 9.
        </Say>
        <Gather action="https://donutdash.app/api/telnyx/voice" method="POST" numDigits="1" timeout="5"/>
        <Redirect method="POST">https://donutdash.app/api/telnyx/voice</Redirect>
      `)

    case '0':
      // Forward to representative
      if (!isBusinessHours()) {
        return texml(`
          <Say voice="Azure.en-US-JennyNeural" language="en-US">
            Our office is currently closed. Our support hours are 8 AM to 4 PM Central Time, 7 days a week.
            Please call back during business hours, or email us at support at donut dash dot app.
            Thank you for calling DonutDash. Goodbye!
          </Say>
          <Hangup/>
        `)
      }
      return texml(`
        <Say voice="Azure.en-US-JennyNeural" language="en-US">
          Please hold while we connect you to a representative. This call may be recorded for quality purposes.
        </Say>
        <Dial callerId="+14309990168" timeout="30">
          <Number>${FORWARD_NUMBER}</Number>
        </Dial>
        <Say voice="Azure.en-US-JennyNeural" language="en-US">
          We're sorry, no one is available to take your call right now.
          Please leave a message after the beep, or email us at support at donut dash dot app.
        </Say>
        <Record maxLength="120" action="https://donutdash.app/api/telnyx/voice/voicemail" method="POST"/>
        <Hangup/>
      `)

    case '9':
      // Return to main menu
      return mainMenu()

    default:
      return texml(`
        <Say voice="Azure.en-US-JennyNeural" language="en-US">Invalid selection. Please try again.</Say>
        <Redirect method="POST">https://donutdash.app/api/telnyx/voice</Redirect>
      `)
  }
}

export async function GET() {
  return mainMenu()
}
