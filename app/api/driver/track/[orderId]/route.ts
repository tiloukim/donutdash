import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { haversineDistance } from '@/lib/osrm'
import { AVERAGE_PREP_TIME_MINUTES, AVERAGE_SPEED_MPH } from '@/lib/constants'

export async function GET(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()

  // Get the order to know status and coordinates + ownership info for the
  // authorization check below.
  const { data: order } = await svc
    .from('dd_orders')
    .select('status, delivery_lat, delivery_lng, shop_id, customer_id')
    .eq('id', orderId)
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Authorization: only the customer who placed the order, the assigned
  // driver, the shop owner, or admin/managers can stream live GPS. Without
  // this any logged-in user could enumerate orderIds and stream any
  // driver's location.
  const { data: caller } = await svc
    .from('dd_users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const isAdmin = caller.role === 'admin'
    || caller.role === 'general_manager'
    || caller.role === 'field_manager'
  if (!isAdmin) {
    // Pull the assigned driver_id once for the authorization check.
    const { data: deliveryAuth } = await svc
      .from('dd_deliveries')
      .select('driver_id')
      .eq('order_id', orderId)
      .maybeSingle()
    const { data: shop } = await svc
      .from('dd_shops')
      .select('owner_id')
      .eq('id', order.shop_id)
      .maybeSingle()
    const isCustomer = order.customer_id === caller.id
    const isDriver = deliveryAuth?.driver_id === caller.id
    const isShopOwner = shop?.owner_id === caller.id
    if (!isCustomer && !isDriver && !isShopOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Get the delivery for this order
  const { data: delivery } = await svc
    .from('dd_deliveries')
    .select('id, driver_id, status, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, route_polyline, estimated_duration_min')
    .eq('order_id', orderId)
    .in('status', ['assigned', 'picked_up', 'delivering'])
    .maybeSingle()

  // Calculate ETA
  let eta_minutes: number | null = null

  if (order.status === 'delivered' || order.status === 'cancelled') {
    eta_minutes = 0
  } else if (delivery && order.delivery_lat && order.delivery_lng) {
    // We have a delivery record — compute drive time based on status
    let driverLat = delivery.pickup_lat
    let driverLng = delivery.pickup_lng

    if (delivery.driver_id) {
      const { data: loc } = await svc
        .from('dd_driver_locations')
        .select('lat, lng')
        .eq('driver_id', delivery.driver_id)
        .single()
      if (loc) {
        driverLat = loc.lat
        driverLng = loc.lng
      }
    }

    if (['picked_up', 'delivering'].includes(order.status) && driverLat && driverLng) {
      // Driver is en route to customer
      const dist = haversineDistance(driverLat, driverLng, order.delivery_lat, order.delivery_lng)
      eta_minutes = Math.round((dist / AVERAGE_SPEED_MPH) * 60)
    } else if (order.status === 'ready_for_pickup') {
      // Drive time from shop (or driver) to customer
      const fromLat = driverLat || delivery.pickup_lat
      const fromLng = driverLng || delivery.pickup_lng
      if (fromLat && fromLng) {
        const dist = haversineDistance(fromLat, fromLng, order.delivery_lat, order.delivery_lng)
        eta_minutes = Math.round((dist / AVERAGE_SPEED_MPH) * 60)
      }
    } else {
      // pending/confirmed/preparing: prep time + drive from shop to customer
      const dist = haversineDistance(delivery.pickup_lat, delivery.pickup_lng, order.delivery_lat, order.delivery_lng)
      eta_minutes = AVERAGE_PREP_TIME_MINUTES + Math.round((dist / AVERAGE_SPEED_MPH) * 60)
    }
  } else if (order.delivery_lat && order.delivery_lng) {
    // No delivery record yet — estimate using shop location
    const { data: shop } = await svc
      .from('dd_shops')
      .select('lat, lng')
      .eq('id', order.shop_id)
      .single()

    if (shop?.lat && shop?.lng) {
      const dist = haversineDistance(shop.lat, shop.lng, order.delivery_lat, order.delivery_lng)
      eta_minutes = AVERAGE_PREP_TIME_MINUTES + Math.round((dist / AVERAGE_SPEED_MPH) * 60)
    }
  }

  if (!delivery || !delivery.driver_id) {
    // No active delivery yet — return ETA only
    return NextResponse.json({ eta_minutes })
  }

  // Get driver location
  const { data: location } = await svc
    .from('dd_driver_locations')
    .select('lat, lng, heading, speed, updated_at')
    .eq('driver_id', delivery.driver_id)
    .single()

  // Get driver info
  const { data: driver } = await svc
    .from('dd_users')
    .select('name, avatar_url')
    .eq('id', delivery.driver_id)
    .single()

  // Fallback: if the driver has no custom avatar, surface the latest approved
  // verification selfie so the customer/shop sees a face instead of an initial.
  let selfieUrl: string | null = null
  if (driver && !driver.avatar_url) {
    const { data: selfie } = await svc
      .from('dd_driver_documents')
      .select('file_url')
      .eq('driver_id', delivery.driver_id)
      .eq('doc_type', 'selfie')
      .eq('status', 'approved')
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    selfieUrl = selfie?.file_url || null
  }

  return NextResponse.json({
    delivery_status: delivery.status,
    driver: driver ? { name: driver.name, avatar_url: driver.avatar_url, selfie_url: selfieUrl } : null,
    location: location || null,
    route_polyline: delivery.route_polyline,
    estimated_duration_min: delivery.estimated_duration_min,
    eta_minutes,
  })
}
