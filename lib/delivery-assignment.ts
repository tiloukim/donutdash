import { createServiceClient } from '@/lib/supabase/server'
import { haversineDistance } from './osrm'
import { MAX_DRIVER_DISTANCE_MILES, BASE_DELIVERY_PAY, PER_MILE_PAY, OFFER_TIMEOUT_SECONDS } from './constants'

export async function findNearestAvailableDrivers(shopLat: number, shopLng: number, excludeDriverIds: string[] = []) {
  const svc = createServiceClient()

  const { data: onlineDrivers } = await svc
    .from('dd_driver_locations')
    .select('driver_id, lat, lng')
    .eq('is_online', true)

  if (!onlineDrivers?.length) return []

  // Filter out excluded drivers and busy ones
  const { data: busyDrivers } = await svc
    .from('dd_deliveries')
    .select('driver_id')
    .in('status', ['assigned', 'picked_up', 'delivering'])

  const busyIds = new Set((busyDrivers || []).map(d => d.driver_id))
  const excludeSet = new Set(excludeDriverIds)

  // Check for pending offers
  const { data: pendingOffers } = await svc
    .from('dd_delivery_offers')
    .select('driver_id')
    .eq('status', 'pending')

  const pendingIds = new Set((pendingOffers || []).map(o => o.driver_id))

  return onlineDrivers
    .filter(d => !busyIds.has(d.driver_id) && !excludeSet.has(d.driver_id) && !pendingIds.has(d.driver_id))
    .map(d => ({
      driver_id: d.driver_id,
      lat: d.lat,
      lng: d.lng,
      distance: haversineDistance(shopLat, shopLng, d.lat, d.lng),
    }))
    .filter(d => d.distance <= MAX_DRIVER_DISTANCE_MILES)
    .sort((a, b) => a.distance - b.distance)
}

export async function createDeliveryOffer(deliveryId: string, driverId: string) {
  const svc = createServiceClient()
  const expiresAt = new Date(Date.now() + OFFER_TIMEOUT_SECONDS * 1000).toISOString()

  const { data, error } = await svc
    .from('dd_delivery_offers')
    .insert({
      delivery_id: deliveryId,
      driver_id: driverId,
      status: 'pending',
      expires_at: expiresAt,
    })
    .select()
    .single()

  return { data, error }
}

export async function assignNextDriver(deliveryId: string) {
  const svc = createServiceClient()

  // Get the delivery with shop location
  const { data: delivery } = await svc
    .from('dd_deliveries')
    .select('*, order:dd_orders(*, shop:dd_shops(lat, lng))')
    .eq('id', deliveryId)
    .single()

  if (!delivery || delivery.driver_id) return null

  const shopLat = delivery.order?.shop?.lat
  const shopLng = delivery.order?.shop?.lng
  if (!shopLat || !shopLng) return null

  // Get drivers who already declined/expired for this delivery
  const { data: prevOffers } = await svc
    .from('dd_delivery_offers')
    .select('driver_id')
    .eq('delivery_id', deliveryId)
    .in('status', ['declined', 'expired'])

  const excludeIds = (prevOffers || []).map(o => o.driver_id)
  const nearbyDrivers = await findNearestAvailableDrivers(shopLat, shopLng, excludeIds)

  if (nearbyDrivers.length === 0) return null

  const nearest = nearbyDrivers[0]
  return createDeliveryOffer(deliveryId, nearest.driver_id)
}

export function calculateDriverEarnings(distanceMiles: number, tip: number = 0): number {
  return Math.round((BASE_DELIVERY_PAY + distanceMiles * PER_MILE_PAY + tip) * 100) / 100
}
