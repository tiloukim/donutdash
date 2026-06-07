import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { notifyNewSignup } from '@/lib/sms'

export async function POST(req: NextRequest) {
  const { email, password, name, phone, role } = await req.json()

  if (!email || !password || !name || !role) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!['customer', 'driver', 'shop_owner'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, phone: phone || null, role },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (!data.user) {
    return NextResponse.json({ error: 'User creation failed' }, { status: 500 })
  }

  await supabase.from('profiles').upsert({
    id: data.user.id,
    plan: 'free',
  }, { onConflict: 'id' })

  // Fire-and-forget admin alert (email + SMS via ADMIN_EMAILS /
  // ADMIN_PHONE_NUMBERS env vars). Never block signup on a delivery hiccup.
  notifyNewSignup({
    role,
    name,
    email,
    phone: phone || null,
    source: 'mobile',
  }).catch(() => {})

  // Issue a session via the admin magiclink flow so the client doesn't need to
  // hit signInWithPassword (which is blocked by Supabase Auth's captcha middleware).
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })

  if (linkError || !linkData?.properties?.action_link) {
    return NextResponse.json(
      { error: linkError?.message || 'Failed to issue session', user: data.user },
      { status: 500 }
    )
  }

  const verifyRes = await fetch(linkData.properties.action_link, {
    method: 'GET',
    redirect: 'manual',
  })

  const location = verifyRes.headers.get('location')
  if (!location) {
    return NextResponse.json(
      { error: 'No session redirect from auth verify', user: data.user },
      { status: 500 }
    )
  }

  // Tokens are returned in the URL fragment: ...#access_token=...&refresh_token=...
  const fragment = location.split('#')[1] ?? ''
  const params = new URLSearchParams(fragment)
  const access_token = params.get('access_token')
  const refresh_token = params.get('refresh_token')

  if (!access_token || !refresh_token) {
    // Surface the redirect's error if the fragment carried one
    const errCode = params.get('error_code') || params.get('error')
    const errDesc = params.get('error_description')
    return NextResponse.json(
      { error: errDesc || errCode || 'Session tokens missing from auth redirect', user: data.user },
      { status: 500 }
    )
  }

  const expires_in = params.get('expires_in')

  return NextResponse.json({
    user: data.user,
    session: {
      access_token,
      refresh_token,
      expires_in: expires_in ? parseInt(expires_in, 10) : undefined,
      token_type: params.get('token_type') || 'bearer',
    },
  })
}
