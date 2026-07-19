import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// Resolve the signed-in user's POS staff profile.
// Access rule:
//   - shop_owner / admin / general_manager / field_manager:
//       admin/ops get the first shop they own; non-admin gets their own shop
//   - everyone else (customer, driver, marketing_manager): rejected
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

  const allowedRoles = ['shop_owner', 'admin', 'general_manager', 'field_manager']
  if (!allowedRoles.includes(profile.role)) {
    return NextResponse.json(
      { error: 'POS access is limited to shop owners and platform staff.' },
      { status: 403 },
    )
  }

  // Pick the first shop the user owns (admin / ops often own shops too —
  // e.g. tilou owns Top Donuts). Future shop-selector screen will let
  // platform staff switch between shops they don't own.
  const { data: shopRow } = await svc
    .from('dd_shops')
    .select('id, name, delivery_enabled, pos_enabled')
    .eq('owner_id', profile.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!shopRow) {
    return NextResponse.json(
      {
        error:
          profile.role === 'shop_owner'
            ? 'No shop is linked to this owner account.'
            : 'Platform staff need to own a shop to run POS. Future shop-selector screen will let you pick any shop.',
      },
      { status: 403 },
    )
  }

  return NextResponse.json({
    user_id: profile.id,
    name: profile.name,
    role: profile.role,
    shop_id: shopRow.id,
    shop_name: shopRow.name,
    // delivery_enabled defaults to false in the schema for new (POS-only) shops.
    // The POS app uses this flag to hide DonutDash online-order UI for shops
    // that haven't opted into the delivery marketplace.
    delivery_enabled: shopRow.delivery_enabled ?? false,
    // Admin kill-switch (admin → Shops → Disable POS). Defaults to true so a
    // null/absent column never locks a shop out. The POS shows a lockout
    // screen when this is false; order creation is also rejected server-side.
    pos_enabled: shopRow.pos_enabled ?? true,
  })
}
