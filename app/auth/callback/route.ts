import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  const supabase = await createClient()

  if (code) {
    // OAuth or PKCE flow
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Check user role and redirect accordingly
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const meta = user.user_metadata
        const role = meta?.role || 'customer'
        if (role === 'shop_owner') return NextResponse.redirect(`${origin}/partner-setup`)
        if (role === 'driver') return NextResponse.redirect(`${origin}/driver`)
        if (role === 'admin') return NextResponse.redirect(`${origin}/admin`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  if (token_hash && type) {
    // Email confirmation / magic link / password reset (token hash flow)
    const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as any })
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const meta = user.user_metadata
        const role = meta?.role || 'customer'
        if (type === 'signup' || type === 'email') {
          // First time confirmation — redirect to role-specific page
          if (role === 'shop_owner') return NextResponse.redirect(`${origin}/partner-setup`)
          if (role === 'driver') return NextResponse.redirect(`${origin}/driver`)
          if (role === 'admin') return NextResponse.redirect(`${origin}/admin`)
        }
        if (type === 'recovery') {
          // Password reset — redirect to password update page
          return NextResponse.redirect(`${origin}/update-password`)
        }
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Something went wrong — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=Could+not+verify+email`)
}
