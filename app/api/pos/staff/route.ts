import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// Resolve the signed-in user's POS staff profile.
// Phase 1 access rule:
//   - shop_owner / admin: first shop where dd_shops.owner_id = dd_users.id
//   - everyone else (customer, driver, manager): rejected
//
// Note: dd_users.auth_id is the FK to auth.users.id; dd_users.id is its own PK.
// dd_team_members is intentionally NOT consulted — that table is for digital
// business cards, not POS auth.

export async function GET(_req: NextRequest) {
  const auth = await createClient()
  const { data: userRes, error: userErr } = await auth.auth.getUser()
  if (userErr || !userRes?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const authId = userRes.user.id

  const svc = createServiceClient()
  const { data: profile, error: profileErr } = await svc
    .from('dd_users')
    .select('id, name, role')
    .eq('auth_id', authId)
    .maybeSingle()

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'No DonutDash profile for this account' }, { status: 403 })
  }

  if (profile.role !== 'shop_owner' && profile.role !== 'admin') {
    return NextResponse.json(
      { error: 'POS access is limited to shop owners. Manager support is coming soon.' },
      { status: 403 },
    )
  }

  // Pick the first shop the user owns (admins often own shops too — e.g. tilou owns Top Donuts).
  // A future shop-selector screen will let admins switch between shops they don't own.
  const { data: shopRow } = await svc
    .from('dd_shops')
    .select('id, name')
    .eq('owner_id', profile.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!shopRow) {
    return NextResponse.json(
      {
        error:
          profile.role === 'admin'
            ? 'Admin accounts need a shop to run POS. Become an owner of a shop or wait for the shop-selector screen.'
            : 'No shop is linked to this owner account.',
      },
      { status: 403 },
    )
  }

  const shop = { id: shopRow.id, name: shopRow.name }

  return NextResponse.json({
    user_id: profile.id,
    name: profile.name,
    role: profile.role as 'shop_owner' | 'admin',
    shop_id: shop?.id ?? null,
    shop_name: shop?.name ?? null,
  })
}
