import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { loadOrderParties, phoneForParty, describeParty, type CallParty } from '@/lib/call-bridge'
import { toE164 } from '@/lib/sms'

export const dynamic = 'force-dynamic'

// TeXML for the second leg of an anonymous bridge.
//
// Telnyx fetches this when the CALLER picks up the call we placed to them.
// It answers with a <Dial> to the other party, originating from the DonutDash
// number — so that is the caller id the callee sees, and neither party's real
// number is ever sent to the other handset or to any client.
//
// This endpoint is unauthenticated by necessity: Telnyx calls it, not a user.
// The token is the whole guard, so it is single-use, expires in two minutes,
// and is burned the moment it's redeemed. Everything else — who may talk to
// whom — was settled in /api/calls/initiate before the token existed.

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function texml(content: string) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${content}</Response>`,
    { headers: { 'Content-Type': 'application/xml' } },
  )
}

const VOICE = 'Polly.Joanna'

function spoken(message: string) {
  return texml(`<Say voice="${VOICE}" language="en-US">${xmlEscape(message)}</Say><Hangup/>`)
}

async function handle(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  // Say nothing specific on a bad token — someone poking at this endpoint
  // shouldn't learn whether a token is real, expired, or already used.
  if (!token) return spoken('Sorry, this call could not be connected.')

  const svc = createServiceClient()
  const { data: session } = await svc
    .from('dd_call_sessions')
    .select('id, token, order_id, callee_role, status, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!session) return spoken('Sorry, this call could not be connected.')

  // Single use. 'ringing' is the only state that can be redeemed — a replay
  // arrives as 'bridged' and gets nothing.
  if (session.status !== 'ringing' && session.status !== 'pending') {
    return spoken('Sorry, this call could not be connected.')
  }
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await svc.from('dd_call_sessions').update({ status: 'expired' }).eq('id', session.id)
    return spoken('Sorry, this call has expired. Please try again from the app.')
  }

  // Resolve the number NOW rather than trusting the snapshot taken at
  // initiate: if the driver was swapped in between, the stale row would
  // bridge a stranger into the order.
  const parties = await loadOrderParties(svc, session.order_id)
  if (!parties) return spoken('Sorry, this order is no longer available.')

  const callee = session.callee_role as CallParty
  const target = phoneForParty(parties, callee)
  const e164 = target ? toE164(target) : null
  if (!e164) {
    await svc.from('dd_call_sessions')
      .update({ status: 'failed', failure_reason: 'no_callee_number', ended_at: new Date().toISOString() })
      .eq('id', session.id)
    return spoken('Sorry, we could not reach them right now.')
  }

  // Burn the token before dialing, and only bridge if we actually won the
  // burn. Without checking the result, two concurrent fetches of the same
  // token would both fall through and place two calls.
  const { data: burned } = await svc.from('dd_call_sessions')
    .update({ status: 'bridged', answered_at: new Date().toISOString(), callee_phone: target })
    .eq('id', session.id)
    .eq('status', session.status)
    .select('id')
  if (!burned?.length) return spoken('Sorry, this call could not be connected.')

  const callerId = toE164(process.env.TELNYX_PHONE_NUMBER || '+14309990168')
  const who = xmlEscape(describeParty(parties, callee))

  return texml(`
    <Say voice="${VOICE}" language="en-US">Connecting you to ${who}. Please hold.</Say>
    <Dial callerId="${callerId}" timeout="30" answerOnBridge="true">
      <Number>${e164}</Number>
    </Dial>
    <Say voice="${VOICE}" language="en-US">They did not answer. Please try again later, or send them a message from the app.</Say>
    <Hangup/>
  `)
}

// Telnyx posts here; GET is kept so the URL can be checked by hand.
export const POST = handle
export const GET = handle
