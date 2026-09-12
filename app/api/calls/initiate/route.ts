import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { placeTexmlCall } from '@/lib/voice'
import {
  loadOrderParties, partyForUser, callWindowOpen, phoneForParty,
  newCallToken, type CallParty,
} from '@/lib/call-bridge'

export const dynamic = 'force-dynamic'

// POST /api/calls/initiate  { order_id, to: 'driver' | 'customer' }
//
// Anonymous call bridging. The caller names a ROLE, never a number. We ring
// the caller first; when they answer, the TeXML at /api/telnyx/voice/bridge
// dials the other party outward from the DonutDash number. Neither handset
// ever sees the other's number, and nothing in this response contains one.
//
// Ringing the caller first is deliberate. The other order — ring the callee,
// then call back — makes the callee answer into silence while the initiator's
// phone rings, and wastes their pickup entirely if the initiator has walked
// away. This way the initiator gets immediate feedback that it worked, and
// the callee's phone only rings once someone is definitely on the line.

// The shop is deliberately absent. Its number is a published business line
// — it's on the shop page, in search results, on the receipt — so bridging it
// would burn a billed call to hide something that isn't hidden. Clients dial
// the shop directly. Personal numbers (driver, customer) are the ones worth
// spending a bridge on.
const VALID_TARGETS: CallParty[] = ['driver', 'customer']

// Enough for a driver who can't find the door to try twice and then message,
// low enough that a stuck button can't ring someone twenty times.
const MAX_CALLS_PER_WINDOW = 5
const RATE_WINDOW_MS = 5 * 60 * 1000

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc
    .from('dd_users').select('id, role, name, phone, is_active').eq('auth_id', user.id).maybeSingle()
  if (!ddUser) return NextResponse.json({ error: 'No DonutDash profile' }, { status: 403 })
  if (ddUser.is_active === false) return NextResponse.json({ error: 'Account is deactivated' }, { status: 403 })

  let body: { order_id?: string; to?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const orderId = String(body.order_id ?? '').trim()
  const to = String(body.to ?? '').trim() as CallParty
  if (!orderId) return NextResponse.json({ error: 'order_id is required' }, { status: 400 })
  if (to === ('shop' as CallParty)) {
    return NextResponse.json(
      { error: 'Call the shop directly — its number is public.' },
      { status: 400 },
    )
  }
  if (!VALID_TARGETS.includes(to)) {
    return NextResponse.json({ error: 'to must be driver or customer' }, { status: 400 })
  }

  const parties = await loadOrderParties(svc, orderId)
  if (!parties) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  // The whole feature rests on this check: only someone actually on this
  // order may open a line to anyone else on it.
  const callerParty = partyForUser(parties, ddUser.id, ddUser.role)
  if (!callerParty) return NextResponse.json({ error: 'Not your order' }, { status: 403 })
  if (callerParty === to) return NextResponse.json({ error: 'That is you' }, { status: 400 })

  if (!callWindowOpen(parties)) {
    return NextResponse.json(
      { error: 'This order is closed. Contact support if you still need to reach them.' },
      { status: 409 },
    )
  }

  // An admin has no party phone on the order — ring the number on their profile.
  const callerPhone = callerParty === 'admin' ? ddUser.phone : phoneForParty(parties, callerParty)
  const calleePhone = phoneForParty(parties, to)
  if (!callerPhone) {
    return NextResponse.json({ error: 'Add a phone number to your profile first' }, { status: 400 })
  }
  if (!calleePhone) {
    const who = to === 'driver' ? 'No driver is assigned yet' : `No number on file for the ${to}`
    return NextResponse.json({ error: who }, { status: 409 })
  }

  // Each tap places a real, billed outbound call, and a button that dials
  // someone else's phone is worth throttling on its own account: without
  // this, a tap-happy client rings the callee over and over.
  const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString()
  const { count: recent } = await svc
    .from('dd_call_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('caller_user_id', ddUser.id)
    .gte('created_at', windowStart)
  if ((recent ?? 0) >= MAX_CALLS_PER_WINDOW) {
    return NextResponse.json(
      { error: 'Too many call attempts. Wait a minute and try again.' },
      { status: 429 },
    )
  }

  const token = newCallToken()
  const { data: session, error: insErr } = await svc
    .from('dd_call_sessions')
    .insert({
      token,
      order_id: parties.orderId,
      delivery_id: parties.deliveryId,
      caller_user_id: ddUser.id,
      caller_role: callerParty,
      callee_role: to,
      caller_phone: callerPhone,
      callee_phone: calleePhone,
      status: 'pending',
    })
    .select('id')
    .single()
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://donutdash.app'
  const ok = await placeTexmlCall(callerPhone, `${base}/api/telnyx/voice/bridge?token=${token}`)
  if (!ok) {
    await svc.from('dd_call_sessions')
      .update({ status: 'failed', failure_reason: 'origination_failed', ended_at: new Date().toISOString() })
      .eq('id', session.id)
    return NextResponse.json({ error: 'Could not start the call. Try again.' }, { status: 502 })
  }

  await svc.from('dd_call_sessions').update({ status: 'ringing' }).eq('id', session.id)

  // Deliberately free of phone numbers — the client is told what will happen,
  // not who to dial.
  return NextResponse.json({
    ok: true,
    call_id: session.id,
    message: 'Answer your phone — we\'ll connect you.',
  })
}
