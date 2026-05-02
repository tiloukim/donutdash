import { createServiceClient } from '@/lib/supabase/server'
import { haversineDistance } from './osrm'
import { sendEmail, sendSMS } from './sms'
import { MAX_DRIVER_DISTANCE_MILES, BASE_DELIVERY_PAY, PER_MILE_PAY, OFFER_TIMEOUT_SECONDS, DEFAULT_DELIVERY_FEE } from './constants'

export async function findNearestAvailableDrivers(shopLat: number, shopLng: number, excludeDriverIds: string[] = [], shopId?: string) {
  const svc = createServiceClient()

  // 2 min matches the offline-stale-drivers cron threshold — drivers whose
  // last ping is older than this are treated as offline even if is_online=true,
  // so a force-quit / lost-network app doesn't keep getting offers.
  const staleCutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString()

  const { data: onlineDrivers } = await svc
    .from('dd_driver_locations')
    .select('driver_id, lat, lng')
    .eq('is_online', true)
    .gte('updated_at', staleCutoff)

  console.log('[DRIVER FIND] Online drivers:', onlineDrivers?.length || 0, onlineDrivers?.map(d => ({ id: d.driver_id, lat: d.lat, lng: d.lng })))

  if (!onlineDrivers?.length) return []

  // Get active deliveries per driver (with shop info for batching)
  const { data: busyDrivers } = await svc
    .from('dd_deliveries')
    .select('driver_id, order:dd_orders(shop_id)')
    .in('status', ['assigned', 'picked_up', 'delivering'])

  // Count active deliveries per driver and track their shop_ids
  const driverDeliveryCounts = new Map<string, number>()
  const driverShopIds = new Map<string, Set<string>>()
  for (const d of busyDrivers || []) {
    driverDeliveryCounts.set(d.driver_id, (driverDeliveryCounts.get(d.driver_id) || 0) + 1)
    const sid = (d.order as any)?.shop_id
    if (sid) {
      if (!driverShopIds.has(d.driver_id)) driverShopIds.set(d.driver_id, new Set())
      driverShopIds.get(d.driver_id)!.add(sid)
    }
  }

  // Check for pending offers (only non-expired ones)
  const { data: pendingOffers } = await svc
    .from('dd_delivery_offers')
    .select('driver_id, expires_at')
    .eq('status', 'pending')
    .gte('expires_at', new Date().toISOString())

  const pendingIds = new Set((pendingOffers || []).map(o => o.driver_id))
  const excludeSet = new Set(excludeDriverIds)

  console.log('[DRIVER FIND] Driver delivery counts:', Object.fromEntries(driverDeliveryCounts))
  console.log('[DRIVER FIND] Pending offer drivers:', [...pendingIds])
  console.log('[DRIVER FIND] Excluded drivers:', excludeDriverIds)

  const available = onlineDrivers
    .filter(d => {
      if (excludeSet.has(d.driver_id) || pendingIds.has(d.driver_id)) return false
      if (d.lat === 0 && d.lng === 0) return false // No GPS fix

      const activeCount = driverDeliveryCounts.get(d.driver_id) || 0
      if (activeCount === 0) return true // Free driver
      if (activeCount >= 2) return false // Max 2 stacked deliveries

      // Allow batching: 1 active delivery from the same shop
      if (activeCount === 1 && shopId) {
        const shops = driverShopIds.get(d.driver_id)
        return shops ? shops.has(shopId) : false
      }
      return false
    })
    .map(d => ({
      driver_id: d.driver_id,
      lat: d.lat,
      lng: d.lng,
      distance: haversineDistance(shopLat, shopLng, d.lat, d.lng),
    }))
    .filter(d => d.distance <= MAX_DRIVER_DISTANCE_MILES)
    .sort((a, b) => a.distance - b.distance)

  console.log('[DRIVER FIND] Available after filters:', available.length, available.map(d => ({ id: d.driver_id, dist: d.distance.toFixed(2) })))
  console.log('[DRIVER FIND] Max distance:', MAX_DRIVER_DISTANCE_MILES, 'miles')

  return available
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

  // Send email notification to driver (fire and forget)
  if (data && !error) {
    (async () => {
      const { data: driver } = await svc.from('dd_users').select('email, phone').eq('id', driverId).single()
      const { data: delivery } = await svc
        .from('dd_deliveries')
        .select('driver_earnings, order:dd_orders(total, delivery_address, delivery_city, shop:dd_shops(name))')
        .eq('id', deliveryId)
        .single()

      if (driver && delivery) {
        const order = delivery.order as any
        const shopName = order?.shop?.name || 'Shop'
        const address = [order?.delivery_address, order?.delivery_city].filter(Boolean).join(', ') || 'Customer address'
        const earnings = delivery.driver_earnings ? `$${Number(delivery.driver_earnings).toFixed(2)}` : 'See app'

        // SMS to driver
        if (driver.phone) {
          const driverPhone = driver.phone.startsWith('+') ? driver.phone : `+1${driver.phone.replace(/\D/g, '')}`
          sendSMS(driverPhone, `New delivery offer! ${shopName} - Earn ${earnings}. Open your driver app: donutdash.app/driver`).catch(() => {})
        }

        // Email to driver
        if (driver.email) await sendEmail(
          driver.email,
          'New Delivery Offer - DonutDash',
          `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;">
            <div style="background:#FF8C00;padding:24px 20px;text-align:center;border-radius:12px 12px 0 0;">
              <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">DonutDash</h1>
            </div>
            <div style="padding:24px 20px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;">
              <h2 style="margin:0 0 16px;color:#222;font-size:20px;">You have a new delivery offer!</h2>
              <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 8px;">${shopName} → ${address}</p>
              <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 16px;">Earnings: <strong>${earnings}</strong></p>
              <a href="https://donutdash.app/driver" style="display:inline-block;padding:12px 28px;background:#FF8C00;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">Open Driver App</a>
              <p style="margin-top:24px;font-size:12px;color:#aaa;">Open your driver app to accept this offer before it expires.</p>
            </div>
          </div>`
        )
      }
    })().catch(() => {})
  }

  return { data, error }
}

// Max number of individual driver offers before leaving it in Available Deliveries
const MAX_OFFER_ATTEMPTS = 3

export async function assignNextDriver(deliveryId: string) {
  const svc = createServiceClient()

  // Get the delivery with shop location
  const { data: delivery } = await svc
    .from('dd_deliveries')
    .select('*, order:dd_orders(*, shop:dd_shops(lat, lng))')
    .eq('id', deliveryId)
    .single()

  if (!delivery) {
    console.log('[ASSIGN] Delivery not found:', deliveryId)
    return null
  }
  if (delivery.driver_id) {
    console.log('[ASSIGN] Delivery already has driver:', delivery.driver_id)
    return null
  }

  const shopLat = delivery.order?.shop?.lat
  const shopLng = delivery.order?.shop?.lng
  if (!shopLat || !shopLng) {
    console.log('[ASSIGN] Shop has no coordinates - shopLat:', shopLat, 'shopLng:', shopLng)
    return null
  }

  // Get drivers who already declined/expired for this delivery
  const { data: prevOffers } = await svc
    .from('dd_delivery_offers')
    .select('driver_id')
    .eq('delivery_id', deliveryId)
    .in('status', ['declined', 'expired'])

  const excludeIds = (prevOffers || []).map(o => o.driver_id)

  // Stop auto-offering after MAX_OFFER_ATTEMPTS — let it sit in Available Deliveries
  if (excludeIds.length >= MAX_OFFER_ATTEMPTS) {
    console.log(`[ASSIGN] Reached ${MAX_OFFER_ATTEMPTS} offer attempts for delivery ${deliveryId}, moving to Available Deliveries`)
    return null
  }

  const shopId = (delivery.order as any)?.shop_id
  const nearbyDrivers = await findNearestAvailableDrivers(shopLat, shopLng, excludeIds, shopId)

  if (nearbyDrivers.length === 0) return null

  const nearest = nearbyDrivers[0]
  return createDeliveryOffer(deliveryId, nearest.driver_id)
}

export function calculateDriverEarnings(distanceMiles: number, tip: number = 0): number {
  // distanceMiles is one-way (shop → customer) from haversineDistance.
  // Spec pays per mile of round-trip distance, so multiply by 2.
  const roundTripMiles = distanceMiles * 2
  const earnings = BASE_DELIVERY_PAY + (roundTripMiles * PER_MILE_PAY) + tip
  return Math.round(earnings * 100) / 100
}

export function calculateDeliveryFee(): number {
  return DEFAULT_DELIVERY_FEE
}

// Admin profit per delivery = delivery fee + service fee - driver pay (excluding tip)
export function calculateAdminProfit(distanceMiles: number, serviceFee: number): {
  deliveryFee: number
  driverPay: number
  adminProfit: number
} {
  const deliveryFee = DEFAULT_DELIVERY_FEE
  const driverPay = calculateDriverEarnings(distanceMiles, 0) // exclude tip
  const adminProfit = deliveryFee + serviceFee - driverPay
  return { deliveryFee, driverPay, adminProfit: Math.round(adminProfit * 100) / 100 }
}
