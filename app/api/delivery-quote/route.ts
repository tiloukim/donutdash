import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { haversineDistance } from '@/lib/osrm'
import { getPayConfig } from '@/lib/pay-config'
import { MAX_DELIVERY_MILES } from '@/lib/constants'
import { estimateDeliveryEta } from '@/lib/eta'

export const dynamic = 'force-dynamic'

// Quotes the distance-based delivery fee for an address so the checkout page
// can show the exact fee the server will charge (no surprise at payment).
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { shopId, address, city } = await req.json()
  if (!shopId || !address) return NextResponse.json({ error: 'Missing shop or address' }, { status: 400 })

  const svc = createServiceClient()
  const { data: shop } = await svc.from('dd_shops')
    .select('lat, lng, delivery_fee, delivery_radius_miles').eq('id', shopId).maybeSingle()
  if (!shop || shop.lat == null || shop.lng == null) {
    return NextResponse.json({ error: 'Shop location unavailable' }, { status: 400 })
  }

  // Geocode: Google first (reliable), Nominatim fallback — matches checkout.
  const fullAddress = `${address}, ${city || ''}`
  let lat: number | null = null, lng: number | null = null
  const gKey = process.env.GOOGLE_PLACES_API_KEY
  if (gKey) {
    try {
      const g = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${gKey}`).then(r => r.json())
      if (g.status === 'OK' && g.results?.[0]) { lat = g.results[0].geometry.location.lat; lng = g.results[0].geometry.location.lng }
    } catch { /* fall through */ }
  }
  if (lat == null || lng == null) {
    try {
      const n = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=1`, { headers: { 'User-Agent': 'DonutDash/1.0' } }).then(r => r.json())
      if (n?.[0]) { lat = parseFloat(n[0].lat); lng = parseFloat(n[0].lon) }
    } catch { /* handled below */ }
  }
  if (lat == null || lng == null) {
    return NextResponse.json({ error: "Couldn't locate that address", located: false }, { status: 200 })
  }

  const distance = haversineDistance(shop.lat, shop.lng, lat, lng)
  const maxMiles = shop.delivery_radius_miles != null ? Number(shop.delivery_radius_miles) : MAX_DELIVERY_MILES
  const cfg = await getPayConfig()
  const base = shop.delivery_fee ?? cfg.defaultDeliveryFee
  const extraMiles = Math.max(0, distance - cfg.deliveryFreeMiles)
  const deliveryFee = Math.round((base + extraMiles * cfg.deliveryPerExtraMile) * 100) / 100

  const eta = estimateDeliveryEta(distance)
  return NextResponse.json({
    located: true,
    distanceMiles: Math.round(distance * 10) / 10,
    deliveryFee,
    inRange: distance <= maxMiles,
    maxMiles,
    etaLabel: eta.label,
  })
}
