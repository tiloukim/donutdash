import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { assignNextDriver } from '@/lib/delivery-assignment'
import { getPayConfig } from '@/lib/pay-config'
import { haversineDistance } from '@/lib/osrm'

// Safety net: a delivery order should get a dd_deliveries row + driver dispatch
// the moment the shop confirms it (see shop/orders + orders/[id] confirm blocks).
// But that creation is coupled to the exact pending->confirmed transition and
// swallows insert errors, so an order can end up confirmed/preparing/ready with
// NO delivery and NO driver ever alerted. This cron finds those orphans and
// creates + dispatches them. Runs every minute.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()

  // Active delivery orders that should have a driver working. Look back 24h so a
  // long-stranded order still gets rescued, but skip orders updated in the last
  // 90s to avoid racing the normal confirm-time creation path.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const graceBefore = new Date(Date.now() - 90 * 1000).toISOString()

  const { data: orders } = await svc
    .from('dd_orders')
    .select('id, tip, delivery_lat, delivery_lng, updated_at, shop:dd_shops(lat, lng)')
    .eq('fulfillment_type', 'delivery')
    .neq('order_type', 'pos_walkin')
    .in('status', ['confirmed', 'preparing', 'ready_for_pickup'])
    .gte('created_at', since)
    .lte('updated_at', graceBefore)

  if (!orders || orders.length === 0) return NextResponse.json({ dispatched: 0 })

  // Which of these already have a delivery row?
  const ids = orders.map(o => o.id)
  const { data: existing } = await svc.from('dd_deliveries').select('order_id').in('order_id', ids)
  const hasDelivery = new Set((existing || []).map(d => d.order_id))
  const orphans = orders.filter(o => !hasDelivery.has(o.id))

  const cfg = await getPayConfig()
  let dispatched = 0
  for (const o of orphans) {
    const shop = o.shop as { lat?: number; lng?: number } | null
    const shopLat = shop?.lat || 0, shopLng = shop?.lng || 0
    const dropLat = o.delivery_lat || 0, dropLng = o.delivery_lng || 0
    const dist = (shopLat && shopLng && dropLat && dropLng) ? haversineDistance(shopLat, shopLng, dropLat, dropLng) : 0
    const tip = Number(o.tip) || 0
    const earnings = Math.round((cfg.driverBasePay + dist * cfg.driverPerMile + tip) * 100) / 100

    const { data: delivery, error } = await svc.from('dd_deliveries').insert({
      order_id: o.id,
      status: 'pending',
      pickup_lat: shopLat || null,
      pickup_lng: shopLng || null,
      dropoff_lat: o.delivery_lat,
      dropoff_lng: o.delivery_lng,
      distance_miles: dist,
      driver_earnings: earnings,
      base_pay: cfg.driverBasePay,
    }).select('id').single()

    if (error) {
      console.error('[orphan-dispatch] delivery insert failed for order', o.id, error.message)
      continue
    }
    if (delivery) {
      await assignNextDriver(delivery.id).catch(e => console.error('[orphan-dispatch] assign failed', o.id, e))
      dispatched++
      console.log('[orphan-dispatch] rescued order', o.id, '-> delivery', delivery.id)
    }
  }

  return NextResponse.json({ dispatched, checked: orphans.length })
}
