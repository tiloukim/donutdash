import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/client-ip'

export const dynamic = 'force-dynamic'

// Provisions a dd_users row for a guest checkout. The client first calls
// supabase.auth.signInAnonymously() (a real but anonymous session), then posts
// their name/phone here. We create the profile with the SERVICE client because
// there is no INSERT RLS policy for regular users on dd_users. Once the row
// exists, the existing dd_orders INSERT policy (auth_id = auth.uid()) passes and
// the whole authenticated checkout + order-tracking flow works unchanged.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    return NextResponse.json({ error: 'No session.' }, { status: 401 })
  }
  // Guests only — never let a real (email) account get downgraded/overwritten here.
  if (!authUser.is_anonymous) {
    return NextResponse.json({ error: 'Already signed in.' }, { status: 400 })
  }

  const ip = getClientIp(req.headers)
  const { allowed } = await checkRateLimit(`guest-provision:ip:${ip}`, 15, 15 * 60_000)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again shortly.' }, { status: 429 })
  }

  const { name, phone } = await req.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 })
  }
  if (!phone?.trim()) {
    return NextResponse.json({ error: 'Please enter a phone number.' }, { status: 400 })
  }

  const svc = createServiceClient()

  // Idempotent: if this guest already provisioned (e.g. edited their info and
  // re-submitted), update the existing row rather than colliding on auth_id.
  const { data: existing } = await svc
    .from('dd_users')
    .select('id')
    .eq('auth_id', authUser.id)
    .maybeSingle()

  if (existing) {
    await svc.from('dd_users').update({ name: name.trim(), phone: phone.trim() }).eq('id', existing.id)
    return NextResponse.json({ ok: true, id: existing.id })
  }

  // dd_users.email is NOT NULL UNIQUE. Anonymous auth users have no email, so
  // synthesize a unique, non-deliverable address keyed to the (unique) auth id.
  // The guest's REAL email (if any) rides on the order as customer_email.
  const email = `guest-${authUser.id}@guest.donutdash.app`
  const { data, error } = await svc
    .from('dd_users')
    .insert({
      auth_id: authUser.id,
      email,
      name: name.trim(),
      phone: phone.trim(),
      role: 'customer',
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, id: data.id })
}
