import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

// Role → home page mapping
const ROLE_HOME: Record<string, string> = {
  driver: '/driver',
  shop_owner: '/shop',
  admin: '/admin',
  manager: '/admin',
}

// Pages that should redirect logged-in role users to their dashboard
const REDIRECT_PATHS = ['/', '/login', '/signup']

// Pages each role is allowed to access (prefix match)
const ROLE_ALLOWED: Record<string, string[]> = {
  driver: ['/driver', '/api', '/privacy', '/terms', '/sms-consent', '/contractor-agreement'],
  shop_owner: ['/shop', '/api', '/privacy', '/terms', '/sms-consent', '/partner-setup'],
  admin: ['/admin', '/api', '/privacy', '/terms', '/sms-consent', '/shop', '/driver'],
  manager: ['/admin', '/api', '/privacy', '/terms', '/sms-consent'],
  customer: ['/', '/shops', '/cart', '/orders', '/checkout', '/api', '/privacy', '/terms', '/sms-consent', '/gift-cards', '/rewards', '/about', '/signup', '/login', '/catering', '/group-order', '/card', '/pass', '/best-donuts', '/donut-delivery'],
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the auth token
  const { data: { user: authUser } } = await supabase.auth.getUser()

  // No auth user — let them through (public pages, login, etc.)
  if (!authUser) return supabaseResponse

  const pathname = request.nextUrl.pathname

  // Skip role check for API routes and static assets
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/')) {
    return supabaseResponse
  }

  // Look up the user's role from dd_users
  // Use a cookie cache to avoid DB lookup on every request
  let role: string = request.cookies.get('dd_role')?.value || ''

  if (!role) {
    try {
      const svc = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const { data } = await svc
        .from('dd_users')
        .select('role')
        .eq('auth_id', authUser.id)
        .single()

      role = data?.role ?? 'customer'

      // Cache role in a cookie so we don't query DB every request
      supabaseResponse.cookies.set('dd_role', role, {
        path: '/',
        maxAge: 300, // 5 min cache
        httpOnly: true,
        sameSite: 'lax',
      })
    } catch {
      role = 'customer'
    }
  }

  // Redirect from landing/login/signup to role dashboard
  if (REDIRECT_PATHS.includes(pathname) && role !== 'customer') {
    const home = ROLE_HOME[role]
    if (home) {
      const url = request.nextUrl.clone()
      url.pathname = home
      const redirect = NextResponse.redirect(url)
      // Preserve auth cookies
      supabaseResponse.cookies.getAll().forEach(c =>
        redirect.cookies.set(c.name, c.value)
      )
      redirect.cookies.set('dd_role', role, {
        path: '/',
        maxAge: 300,
        httpOnly: true,
        sameSite: 'lax',
      })
      return redirect
    }
  }

  // Prevent role users from accessing wrong sections
  // e.g., driver shouldn't access /shop, shop_owner shouldn't access /driver
  const allowed = ROLE_ALLOWED[role] || ROLE_ALLOWED.customer
  const isAllowed = allowed.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'))

  if (!isAllowed) {
    const home = ROLE_HOME[role] || '/'
    const url = request.nextUrl.clone()
    url.pathname = home
    const redirect = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach(c =>
      redirect.cookies.set(c.name, c.value)
    )
    return redirect
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
