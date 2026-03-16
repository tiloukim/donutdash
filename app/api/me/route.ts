import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    // Use service client to bypass RLS for user lookup and creation
    const svc = createServiceClient()

    const { data: user, error: dbError } = await svc
      .from('dd_users')
      .select('*')
      .eq('auth_id', authUser.id)
      .single()

    if (dbError || !user) {
      // User exists in auth but not in dd_users table - auto-create
      const meta = authUser.user_metadata || {}
      const { data: newUser, error: insertError } = await svc
        .from('dd_users')
        .insert({
          auth_id: authUser.id,
          email: authUser.email!,
          name: meta.name || authUser.email!.split('@')[0],
          phone: meta.phone || null,
          role: meta.role || 'customer',
        })
        .select()
        .single()

      if (insertError) {
        console.error('Failed to create dd_user:', insertError)
        return NextResponse.json({ user: null }, { status: 500 })
      }

      return NextResponse.json({ user: newUser })
    }

    return NextResponse.json({ user })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
