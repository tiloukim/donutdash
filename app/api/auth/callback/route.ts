import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Validate redirect target is a same-origin relative path so a phishing
// link like ?next=https://evil.com/login can't ride the OAuth flow.
function safeNext(next: string | null): string {
  if (!next || typeof next !== 'string') return '/'
  if (!next.startsWith('/')) return '/'
  // Reject protocol-relative URLs that look like paths (`//evil.com/x`)
  if (next.startsWith('//')) return '/'
  return next
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
