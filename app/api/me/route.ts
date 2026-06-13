import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { notifyNewSignup } from '@/lib/sms'

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
      const role = meta.role || 'customer'
      const { data: newUser, error: insertError } = await svc
        .from('dd_users')
        .insert({
          auth_id: authUser.id,
          email: authUser.email!,
          name: meta.name || authUser.email!.split('@')[0],
          phone: meta.phone || null,
          role,
          driver_status: role === 'driver' ? 'pending_documents' : null,
        })
        .select()
        .single()

      if (insertError) {
        // Email may collide with a PRE-SEEDED row (e.g. admin created
        // a placeholder for a shop owner who's now signing up). Only
        // rebind if auth_id is null — never overwrite an existing auth
        // binding, since that's an account takeover vector: anyone
        // signing up with admin@... would inherit admin's row.
        const { data: existing } = await svc
          .from('dd_users')
          .select('id, auth_id')
          .eq('email', authUser.email!)
          .maybeSingle()

        if (existing && existing.auth_id == null) {
          const { data: linked, error: linkError } = await svc
            .from('dd_users')
            .update({ auth_id: authUser.id })
            .eq('id', existing.id)
            .is('auth_id', null) // double-check at write time vs. race
            .select()
            .single()
          if (!linkError && linked) {
            return NextResponse.json({ user: linked })
          }
        }

        console.error('Failed to create dd_user:', insertError)
        return NextResponse.json({ user: null }, { status: 500 })
      }

      // First time we've seen this auth user — a real signup, not a
      // re-login. Fire-and-forget admin alert via the shared notifier.
      // Web signups land here on the post-confirmation /me call; mobile
      // signups are caught earlier in /api/auth/app-signup.
      notifyNewSignup({
        role: newUser.role,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        source: 'web',
      }).catch(() => {})

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
