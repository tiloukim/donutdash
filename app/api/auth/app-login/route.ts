import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/client-ip'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Missing email or password' }, { status: 400 })
  }

  const trimmedEmail = String(email).trim().toLowerCase()
  const ip = getClientIp(req.headers)

  // Rate-limit credential-stuffing attempts. Per-IP catches single-source
  // bursts; per-email catches a distributed slow attack on one account.
  const ipLimit = await checkRateLimit(`login:ip:${ip}`, 10, 60_000)
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: 'Too many login attempts. Try again in a minute.' }, { status: 429 })
  }
  const emailLimit = await checkRateLimit(`login:email:${trimmedEmail}`, 5, 15 * 60_000)
  if (!emailLimit.allowed) {
    return NextResponse.json({ error: 'Too many login attempts. Try again in 15 minutes.' }, { status: 429 })
  }

  const supabase = createServiceClient()

  // Verify password without going through captcha-protected signInWithPassword.
  // The RPC compares the bcrypt hash in auth.users via pgcrypto's crypt().
  const { data: userId, error: verifyError } = await supabase.rpc('verify_user_password', {
    p_email: trimmedEmail,
    p_password: password,
  })

  if (verifyError) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }

  if (!userId) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  // Issue a session via the admin magiclink flow (captcha-free, same trick as
  // app-signup). We follow the action_link with redirect: 'manual' to capture
  // the access/refresh tokens out of the redirect URL fragment.
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: trimmedEmail,
  })

  if (linkError || !linkData?.properties?.action_link) {
    return NextResponse.json(
      { error: linkError?.message || 'Failed to issue session' },
      { status: 500 }
    )
  }

  const verifyRes = await fetch(linkData.properties.action_link, {
    method: 'GET',
    redirect: 'manual',
  })

  const location = verifyRes.headers.get('location')
  if (!location) {
    return NextResponse.json({ error: 'No session redirect from auth verify' }, { status: 500 })
  }

  const fragment = location.split('#')[1] ?? ''
  const params = new URLSearchParams(fragment)
  const access_token = params.get('access_token')
  const refresh_token = params.get('refresh_token')

  if (!access_token || !refresh_token) {
    const errCode = params.get('error_code') || params.get('error')
    const errDesc = params.get('error_description')
    return NextResponse.json(
      { error: errDesc || errCode || 'Session tokens missing from auth redirect' },
      { status: 500 }
    )
  }

  const expires_in = params.get('expires_in')
  const { data: userData } = await supabase.auth.admin.getUserById(userId)

  return NextResponse.json({
    session: {
      access_token,
      refresh_token,
      expires_in: expires_in ? parseInt(expires_in, 10) : undefined,
      token_type: params.get('token_type') || 'bearer',
    },
    user: userData?.user ?? null,
  })
}
