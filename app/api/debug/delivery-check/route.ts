import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { MAX_DRIVER_DISTANCE_MILES } from '@/lib/constants'
import { haversineDistance } from '@/lib/osrm'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser || ddUser.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  // 1. Check recent orders
  const { data: recentOrders } = await svc
    .from('dd_orders')
    .select('id, status, shop_id, delivery_lat, delivery_lng, created_at, shop:dd_shops(name, lat, lng)')
    .order('created_at', { ascending: false })
    .limit(5)

  // 2. Check deliveries
  const { data: deliveries } = await svc
    .from('dd_deliveries')
    .select('id, order_id, driver_id, status, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  // 3. Check delivery offers
  const { data: offers } = await svc
    .from('dd_delivery_offers')
    .select('id, delivery_id, driver_id, status, expires_at, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  // 4. Check online drivers
  const { data: onlineDrivers } = await svc
    .from('dd_driver_locations')
    .select('driver_id, lat, lng, is_online, updated_at')
    .eq('is_online', true)

  // 5. Check busy drivers
  const { data: busyDrivers } = await svc
    .from('dd_deliveries')
    .select('driver_id, status')
    .in('status', ['assigned', 'picked_up', 'delivering'])

  // 6. Check pending offers
  const { data: pendingOffers } = await svc
    .from('dd_delivery_offers')
    .select('driver_id, status, expires_at')
    .eq('status', 'pending')

  // 7. Calculate distances from shop to each online driver
  const driverDistances = (onlineDrivers || []).map(d => {
    const shop = recentOrders?.[0]?.shop as any
    const shopLat = shop?.lat || 0
    const shopLng = shop?.lng || 0
    return {
      driver_id: d.driver_id,
      lat: d.lat,
      lng: d.lng,
      is_online: d.is_online,
      updated_at: d.updated_at,
      distance_from_shop: (shopLat && shopLng && d.lat && d.lng)
        ? haversineDistance(shopLat, shopLng, d.lat, d.lng)
        : 'missing_coords',
      within_range: (shopLat && shopLng && d.lat && d.lng)
        ? haversineDistance(shopLat, shopLng, d.lat, d.lng) <= MAX_DRIVER_DISTANCE_MILES
        : false,
      is_busy: (busyDrivers || []).some(b => b.driver_id === d.driver_id),
      has_pending_offer: (pendingOffers || []).some(o => o.driver_id === d.driver_id),
    }
  })

  return NextResponse.json({
    max_driver_distance_miles: MAX_DRIVER_DISTANCE_MILES,
    recent_orders: recentOrders,
    deliveries,
    offers,
    online_drivers: driverDistances,
    busy_drivers: busyDrivers,
    pending_offers: pendingOffers,
  })
}
