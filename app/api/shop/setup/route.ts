import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const svc = createServiceClient()

  // Try multiple ways to get the authenticated user
  let authId: string | null = null

  // Method 1: getUser() from cookies
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    authId = user.id
  }

  // Method 2: getSession() fallback
  if (!authId) {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) authId = session.user.id
  }

  if (!authId) {
    return NextResponse.json({ error: 'Unauthorized - please sign out and sign back in' }, { status: 401 })
  }

  // Find or create dd_user
  let ddUser = (await svc.from('dd_users').select('*').eq('auth_id', authId).single()).data

  if (!ddUser) {
    // Try to get auth user metadata for auto-creation
    const { data: { user: authUser } } = await svc.auth.admin.getUserById(authId)
    if (authUser) {
      const meta = authUser.user_metadata || {}
      // Try insert
      const { data: newUser, error: insertErr } = await svc.from('dd_users')
        .insert({ auth_id: authId, email: authUser.email!, name: meta.name || authUser.email!.split('@')[0], phone: meta.phone || null, role: meta.role || 'shop_owner' })
        .select().single()

      if (insertErr) {
        // Email conflict — link existing row
        await svc.from('dd_users').update({ auth_id: authId }).eq('email', authUser.email!)
        ddUser = (await svc.from('dd_users').select('*').eq('auth_id', authId).single()).data
      } else {
        ddUser = newUser
      }
    }
  }

  if (!ddUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Only shop_owner or admin can create shops
  if (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin') {
    return NextResponse.json({ error: 'Only shop owners can create shops' }, { status: 403 })
  }

  // Check if user already has a shop
  const { data: existingShop } = await svc.from('dd_shops').select('id').eq('owner_id', ddUser.id).single()
  if (existingShop) {
    return NextResponse.json({ error: 'You already have a shop' }, { status: 400 })
  }

  const { name, description, address, city, state, zip, country, phone } = await req.json()

  if (!name || !address || !city) {
    return NextResponse.json({ error: 'Missing required fields (name, address, city)' }, { status: 400 })
  }

  // Geocode the shop address
  let lat: number | null = null
  let lng: number | null = null
  try {
    const fullAddress = `${address}, ${city}${state ? ', ' + state : ''}${zip ? ' ' + zip : ''}${country ? ', ' + country : ''}`
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=1`,
      { headers: { 'User-Agent': 'DonutDash/1.0' } }
    )
    const geoData = await geoRes.json()
    if (geoData?.[0]) {
      lat = parseFloat(geoData[0].lat)
      lng = parseFloat(geoData[0].lon)
    }
  } catch {}

  // Generate unique slug
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const { data: slugExists } = await svc.from('dd_shops').select('id').eq('slug', slug).single()
  const finalSlug = slugExists ? `${slug}-${Date.now().toString(36)}` : slug

  const { data: shop, error } = await svc.from('dd_shops').insert({
    owner_id: ddUser.id,
    name,
    slug: finalSlug,
    description: description || null,
    address,
    city,
    state,
    zip,
    lat,
    lng,
    phone: phone || null,
    is_active: true,
  }).select().single()

  if (error) {
    console.error('Failed to create shop:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(shop)
}
