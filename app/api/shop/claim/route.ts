import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const svc = createServiceClient()

  // Authenticate the user (mirrors /api/shop/setup)
  let authId: string | null = null
  const { data: { user } } = await supabase.auth.getUser()
  if (user) authId = user.id

  if (!authId) {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) authId = session.user.id
  }

  if (!authId) {
    return NextResponse.json(
      { error: 'Unauthorized - please sign in' },
      { status: 401 }
    )
  }

  // Parse body
  let body: { shop_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const shopId = body.shop_id
  if (!shopId) {
    return NextResponse.json({ error: 'Missing shop_id' }, { status: 400 })
  }

  // Resolve or create the dd_user row for this auth_id
  let ddUser = (
    await svc.from('dd_users').select('*').eq('auth_id', authId).single()
  ).data

  if (!ddUser) {
    const { data: { user: authUser } } = await svc.auth.admin.getUserById(authId)
    if (authUser) {
      const meta = authUser.user_metadata || {}
      const { data: newUser, error: insertErr } = await svc
        .from('dd_users')
        .insert({
          auth_id: authId,
          email: authUser.email!,
          name: meta.name || authUser.email!.split('@')[0],
          phone: meta.phone || null,
          role: meta.role || 'shop_owner',
        })
        .select()
        .single()

      if (insertErr) {
        // Email conflict — link existing row
        await svc
          .from('dd_users')
          .update({ auth_id: authId })
          .eq('email', authUser.email!)
        ddUser = (
          await svc.from('dd_users').select('*').eq('auth_id', authId).single()
        ).data
      } else {
        ddUser = newUser
      }
    }
  }

  if (!ddUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only shop owners can claim shops' },
      { status: 403 }
    )
  }

  // Ensure this user doesn't already own a shop
  const { data: existingOwnedShop } = await svc
    .from('dd_shops')
    .select('id')
    .eq('owner_id', ddUser.id)
    .maybeSingle()

  if (existingOwnedShop) {
    return NextResponse.json(
      { error: 'You already own a shop. You can only claim one shop per account.' },
      { status: 400 }
    )
  }

  // Load the target shop and verify it's unclaimed
  const { data: shop, error: shopErr } = await svc
    .from('dd_shops')
    .select('*')
    .eq('id', shopId)
    .maybeSingle()

  if (shopErr) {
    return NextResponse.json({ error: shopErr.message }, { status: 500 })
  }
  if (!shop) {
    return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
  }
  if (shop.owner_id || shop.is_claimed === true) {
    return NextResponse.json(
      { error: 'This shop has already been claimed.' },
      { status: 409 }
    )
  }

  // Claim the shop
  const { data: updated, error: updateErr } = await svc
    .from('dd_shops')
    .update({
      owner_id: ddUser.id,
      is_claimed: true,
      claimed_at: new Date().toISOString(),
    })
    .eq('id', shopId)
    // Guard against race conditions — only succeed if still unclaimed
    .is('owner_id', null)
    .select()
    .single()

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: updateErr?.message || 'Could not claim shop (it may have just been claimed by someone else).' },
      { status: 409 }
    )
  }

  return NextResponse.json({ shop: updated })
}
