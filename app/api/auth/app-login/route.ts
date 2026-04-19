import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Missing email or password' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Verify credentials using admin API
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }

  // Use signInWithPassword via service client (bypasses captcha)
  const { createClient } = await import('@supabase/supabase-js')
  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await authClient.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }

  return NextResponse.json({
    session: data.session,
    user: data.user,
  })
}
