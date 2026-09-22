import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerShop } from '@/lib/shop-auth'
import {
  credentialsKeyConfigured,
  encryptToken,
  listSquareLocations,
} from '@/lib/shop-square'

// Connecting a shop's own Square account.
//
//   GET     what is connected — never the token, only whether one is stored
//   POST    validate a token, then store it encrypted
//   DELETE  forget it
//
// Owner or admin only. A Square access token is the merchant's whole
// account, so the bar is the same as for anything else that moves money.

export const dynamic = 'force-dynamic'
export const maxDuration = 30

async function requireShop() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }

  const svc = createServiceClient()
  const { data: me } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!me || (me.role !== 'shop_owner' && me.role !== 'admin')) {
    return { error: 'Forbidden', status: 403 as const }
  }
  const shop = await resolveOwnerShop(svc, me.id)
  if (!shop) return { error: 'No shop', status: 404 as const }
  return { svc, shop }
}

export async function GET() {
  const a = await requireShop()
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  const { data } = await a.svc
    .from('dd_shops')
    .select('square_location_id, square_connected_at, square_merchant_name, square_access_token')
    .eq('id', a.shop.id)
    .maybeSingle()

  const row = data as {
    square_location_id?: string | null
    square_connected_at?: string | null
    square_merchant_name?: string | null
    square_access_token?: string | null
  } | null

  return NextResponse.json({
    // Deliberately a boolean. There is no reason for a token to travel back
    // to a browser, and "is something stored" is the only part the screen
    // needs in order to say connected or not.
    connected: Boolean(row?.square_access_token),
    locationId: row?.square_location_id ?? null,
    locationName: row?.square_merchant_name ?? null,
    connectedAt: row?.square_connected_at ?? null,
    keyConfigured: credentialsKeyConfigured(),
  })
}

export async function POST(req: NextRequest) {
  const a = await requireShop()
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  if (!credentialsKeyConfigured()) {
    // Refuse rather than storing a token in the clear. A missing key is a
    // deployment problem; a plaintext token in the database is a breach
    // waiting for one.
    return NextResponse.json(
      { error: 'SQUARE_CREDENTIALS_KEY is not set on the server, so a token cannot be stored safely.' },
      { status: 503 },
    )
  }

  const body = await req.json().catch(() => null) as { token?: string; locationId?: string } | null
  const token = body?.token?.trim()
  if (!token) return NextResponse.json({ error: 'Paste your Square access token.' }, { status: 400 })

  // Prove the token works BEFORE storing it, and get the locations from
  // Square rather than trusting what was typed. A wrong location id does not
  // error later — it reads as a day with no sales, which is the hardest kind
  // of wrong to notice.
  let locations
  try {
    locations = await listSquareLocations(token)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could not reach Square.' },
      { status: 400 },
    )
  }
  if (locations.length === 0) {
    return NextResponse.json({ error: 'That token can see no locations.' }, { status: 400 })
  }

  // One location needs no choosing; several do, and picking for them would
  // be guessing which till is the shop.
  const chosen = body?.locationId
    ? locations.find((l) => l.id === body.locationId)
    : locations.length === 1
      ? locations[0]
      : null

  if (!chosen) {
    return NextResponse.json({
      needsLocation: true,
      locations,
      error: 'Choose which location is this shop’s register.',
    }, { status: 409 })
  }

  const { error } = await a.svc
    .from('dd_shops')
    .update({
      square_access_token: encryptToken(token),
      square_location_id: chosen.id,
      square_merchant_name: chosen.name,
      square_connected_at: new Date().toISOString(),
    })
    .eq('id', a.shop.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    connected: true,
    locationId: chosen.id,
    locationName: chosen.name,
    locations,
  })
}

export async function DELETE() {
  const a = await requireShop()
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  const { error } = await a.svc
    .from('dd_shops')
    .update({
      square_access_token: null,
      square_location_id: null,
      square_merchant_name: null,
      square_connected_at: null,
    })
    .eq('id', a.shop.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Says what disconnecting does NOT do. Clearing the token stops this
  // platform reading the account; it does not revoke anything at Square,
  // because a pasted token has nothing to revoke. The merchant has to
  // rotate it in their own dashboard, and that difference is the main
  // practical cost of not using OAuth.
  return NextResponse.json({
    connected: false,
    note: 'Removed from DonutDash. The token itself is still valid at Square — rotate it there if you want it dead.',
  })
}
