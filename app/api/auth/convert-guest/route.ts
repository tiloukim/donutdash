import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Called right AFTER the client attaches an email + password to a guest's
// anonymous session (supabase.auth.updateUser). At that point the auth user is
// no longer anonymous and carries the real email; we sync the dd_users profile
// row (which still holds the synthesized guest email) so their account and
// history line up under their real address. Idempotent and best-effort — the
// login credentials are already set by the client, so this only tidies the
// profile.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    return NextResponse.json({ error: 'No session.' }, { status: 401 })
  }
  // The email is the source of truth from the just-completed updateUser.
  const email = authUser.email
  if (!email) {
    // updateUser hasn't landed on this session yet — nothing to sync.
    return NextResponse.json({ error: 'Account not upgraded yet.' }, { status: 409 })
  }

  const { name } = await req.json().catch(() => ({}))
  const svc = createServiceClient()

  const update: { email: string; name?: string } = { email }
  if (typeof name === 'string' && name.trim()) update.name = name.trim()

  const { error } = await svc
    .from('dd_users')
    .update(update)
    .eq('auth_id', authUser.id)

  if (error) {
    // A dd_users row already owns this email (e.g. a pre-seeded placeholder).
    // The auth credentials still work, so the account is usable — just log it
    // and leave the profile email as-is rather than failing the conversion.
    console.warn('[convert-guest] profile email sync failed', { authId: authUser.id, error: error.message })
    return NextResponse.json({ ok: true, profileSynced: false })
  }
  return NextResponse.json({ ok: true, profileSynced: true })
}
