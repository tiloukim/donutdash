import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/client-ip'

export async function POST(req: NextRequest) {
  const { email, redirectTo } = await req.json()

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  // Email-bomb defense. Per-IP catches a single attacker hammering many
  // emails; per-email catches a distributed attack on one target.
  const ip = getClientIp(req.headers)
  const normalized = String(email).trim().toLowerCase()
  const ipLimit = await checkRateLimit(`forgot:ip:${ip}`, 5, 60 * 60_000)
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: 'Too many reset requests. Try again in an hour.' }, { status: 429 })
  }
  const emailLimit = await checkRateLimit(`forgot:email:${normalized}`, 3, 60 * 60_000)
  if (!emailLimit.allowed) {
    return NextResponse.json({ error: 'Too many reset requests for this email. Try again in an hour.' }, { status: 429 })
  }

  // Use service role client to bypass captcha
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectTo || `${process.env.NEXT_PUBLIC_SITE_URL || 'https://donutdash.app'}/auth/callback?next=/reset-password`,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
