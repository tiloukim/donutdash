import { createServiceClient } from '@/lib/supabase/server'
import { haversineDistance } from './osrm'
import { sendEmail, sendSMS } from './sms'
import { sendPushToUser } from './push-server'
import { getPayConfig } from './pay-config'
import { MAX_DRIVER_DISTANCE_MILES, OFFER_TIMEOUT_SECONDS, DRIVER_STALE_MS, BATCH_DROPOFF_RADIUS_MILES, MAX_STACKED_DELIVERIES } from './constants'

export async function findNearestAvailableDrivers(
  shopLat: number,
  shopLng: number,
  excludeDriverIds: string[] = [],
  shopId?: string,
  /** Drop-off of the delivery being offered — batching only stacks orders
   *  heading the same way, so we compare this against what the driver is
   *  already carrying. Omitted (legacy callers) falls back to shop-only. */
  dropLat?: number | null,
  dropLng?: number | null,
) {
  const svc = createServiceClient()

  // Matches the offline-stale-drivers cron threshold (DRIVER_STALE_MS) — a
  // driver whose last ping is older than this is treated as gone even if
  // is_online is still true, so a force-quit / lost-network app doesn't keep
  // getting offers. Keeping the two thresholds equal avoids the gap where a
  // driver shows "online" but is silently excluded from dispatch.
  const staleCutoff = new Date(Date.now() - DRIVER_STALE_MS).toISOString()

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
    .select('driver_id, dropoff_lat, dropoff_lng, order:dd_orders(shop_id)')
    .in('status', ['assigned', 'picked_up', 'delivering'])

  // Count active deliveries per driver and track their shop_ids
  const driverDeliveryCounts = new Map<string, number>()
  const driverShopIds = new Map<string, Set<string>>()
  const driverDropoffs = new Map<string, { lat: number; lng: number }[]>()
  function noteLoad(driverId: string, sid: unknown, lat: unknown, lng: unknown) {
    driverDeliveryCounts.set(driverId, (driverDeliveryCounts.get(driverId) || 0) + 1)
    if (typeof sid === 'string') {
      if (!driverShopIds.has(driverId)) driverShopIds.set(driverId, new Set())
      driverShopIds.get(driverId)!.add(sid)
    }
    if (typeof lat === 'number' && typeof lng === 'number') {
      if (!driverDropoffs.has(driverId)) driverDropoffs.set(driverId, [])
      driverDropoffs.get(driverId)!.push({ lat, lng })
    }
  }
  for (const d of busyDrivers || []) {
    noteLoad(d.driver_id, (d.order as any)?.shop_id, d.dropoff_lat, d.dropoff_lng)
  }

  // Check for pending offers (only non-expired ones)
  // A pending offer used to exclude a driver outright. That quietly defeated
  // batching whenever two orders from one shop were dispatched close together
  // — the shop accepts both back to back, the driver has a pending offer on
  // the first and zero active deliveries, so the second skipped past them to
  // another driver. Two trips to the same street. Pending offers now count as
  // load, so a driver can be stacked while still deciding.
  const { data: pendingOffers } = await svc
    .from('dd_delivery_offers')
    .select('driver_id, delivery:dd_deliveries(dropoff_lat, dropoff_lng, order:dd_orders(shop_id))')
    .eq('status', 'pending')
    .gte('expires_at', new Date().toISOString())

  for (const o of pendingOffers || []) {
    const del = o.delivery as any
    noteLoad(o.driver_id, del?.order?.shop_id, del?.dropoff_lat, del?.dropoff_lng)
  }

  const excludeSet = new Set(excludeDriverIds)

  console.log('[DRIVER FIND] Driver delivery counts:', Object.fromEntries(driverDeliveryCounts))
  console.log('[DRIVER FIND] Pending offers counted as load:', (pendingOffers || []).length)
  console.log('[DRIVER FIND] Excluded drivers:', excludeDriverIds)

  const available = onlineDrivers
    .filter(d => {
      if (excludeSet.has(d.driver_id)) return false
      if (d.lat === 0 && d.lng === 0) return false // No GPS fix

      const activeCount = driverDeliveryCounts.get(d.driver_id) || 0
      if (activeCount === 0) return true // Free driver
      if (activeCount >= MAX_STACKED_DELIVERIES) return false

      // Batching: same shop, and actually heading the same way. Same shop
      // alone isn't enough — two Top Donuts orders going to opposite ends of
      // Tyler are two trips however they're dispatched, and stacking them
      // just makes the second customer wait through the first.
      if (!shopId) return false
      const shops = driverShopIds.get(d.driver_id)
      if (!shops?.has(shopId)) return false

      // No drop-off given (legacy callers) — fall back to shop-only batching
      // rather than refusing to batch at all.
      if (dropLat == null || dropLng == null) return true

      const drops = driverDropoffs.get(d.driver_id) ?? []
      if (drops.length === 0) return true
      return drops.some(
        (p) => haversineDistance(p.lat, p.lng, dropLat, dropLng) <= BATCH_DROPOFF_RADIUS_MILES,
      )
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

        // Web push (reaches a backgrounded/closed app; loudest + fastest channel)
        sendPushToUser(driverId, {
          title: 'New Delivery Offer!',
          body: `${shopName} — Earn ${earnings}. Tap to accept before it expires.`,
          url: '/driver',
          tag: 'delivery-offer',
        }).catch(() => {})

        // SMS fallback — ONLY for drivers with no working push subscription.
        // iPhone drivers can't get web push unless they install the PWA to their
        // Home Screen, so without this they'd never hear about an offer. Drivers
        // who DO have push (e.g. Android) stay app-only and get no SMS.
        if (driver.phone) {
          const { count: pushCount } = await svc
            .from('dd_push_subscriptions')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', driverId)
          if (!pushCount) {
            sendSMS(
              driver.phone,
              `New DonutDash delivery offer: ${shopName} — earn ${earnings}. Open your driver app to accept before it expires: https://donutdash.app/driver`,
            ).catch(() => {})
          }
        }

        // Email to driver
        if (driver.email) await sendEmail(
          driver.email,
          'New Delivery Offer - DonutDash',
          `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;">
            <div style="background:#FF8C00;padding:24px 20px;text-align:center;border-radius:12px 12px 0 0;">
              <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">DonutDash&trade;</h1>
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

// Create the dd_deliveries row for a delivery order (if it doesn't exist yet)
// and dispatch the nearest driver. Idempotent — safe to call from checkout
// (dispatch at placement), the shop confirm path, and the orphan-dispatch cron.
export async function createDeliveryAndDispatch(order: {
  id: string
  shopLat: number | null
  shopLng: number | null
  dropLat: number | null
  dropLng: number | null
  tip: number | null
}): Promise<void> {
  const svc = createServiceClient()
  const { data: existing } = await svc
    .from('dd_deliveries').select('id').eq('order_id', order.id).maybeSingle()
  let deliveryId = existing?.id
  if (!existing) {
    const dist = (order.shopLat && order.shopLng && order.dropLat && order.dropLng)
      ? haversineDistance(order.shopLat, order.shopLng, order.dropLat, order.dropLng) : 0
    const cfg = await getPayConfig()
    const tip = Number(order.tip) || 0
    const earnings = Math.round((cfg.driverBasePay + dist * cfg.driverPerMile + tip) * 100) / 100
    const { data: delivery, error } = await svc.from('dd_deliveries').insert({
      order_id: order.id, status: 'pending',
      pickup_lat: order.shopLat, pickup_lng: order.shopLng,
      dropoff_lat: order.dropLat, dropoff_lng: order.dropLng,
      distance_miles: dist, driver_earnings: earnings, base_pay: cfg.driverBasePay,
    }).select('id').single()
    if (error) { console.error('[dispatch] delivery insert failed for order', order.id, error.message); return }
    deliveryId = delivery?.id
  }
  if (deliveryId) await assignNextDriver(deliveryId)
}

export async function assignNextDriver(deliveryId: string, opts: { force?: boolean } = {}) {
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

  // Stop auto-offering after MAX_OFFER_ATTEMPTS — let it sit in Available
  // Deliveries. `force` bypasses the cap for a fresh urgent round (e.g. the
  // order was just marked ready for pickup and still has no driver).
  if (!opts.force && excludeIds.length >= MAX_OFFER_ATTEMPTS) {
    console.log(`[ASSIGN] Reached ${MAX_OFFER_ATTEMPTS} offer attempts for delivery ${deliveryId}, moving to Available Deliveries`)
    return null
  }

  const shopId = (delivery.order as any)?.shop_id
  const nearbyDrivers = await findNearestAvailableDrivers(
    shopLat, shopLng, excludeIds, shopId,
    delivery.dropoff_lat, delivery.dropoff_lng,
  )

  if (nearbyDrivers.length === 0) return null

  const nearest = nearbyDrivers[0]
  return createDeliveryOffer(deliveryId, nearest.driver_id)
}

// Driver earnings / delivery fee helpers moved to lib/pay-config.ts —
// quoteDriverEarnings() reads from dd_platform_settings at runtime so
// the admin Settings page actually controls pay. Old constant-only
// helpers were removed to keep callers from grabbing the stale path.
