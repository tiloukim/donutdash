import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
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

  // Geocode the shop address to get GPS coordinates
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
  } catch {
    // Geocoding failed — shop can set location manually later
  }

  // Generate slug from name
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  // Check slug uniqueness
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
