import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { assignNextDriver, calculateDriverEarnings } from '@/lib/delivery-assignment'
import { haversineDistance } from '@/lib/osrm'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { data: order } = await svc
    .from('dd_orders')
    .select('*, dd_order_items(*), shop:dd_shops(name, address, city, lat, lng)')
    .eq('id', id)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  // Only allow the customer, shop owner, driver, or admin to view
  if (ddUser.role !== 'admin' && order.customer_id !== ddUser.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({
    ...order,
    items: order.dd_order_items,
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json()

  // Get current order to check if status is changing from pending to confirmed
  const { data: currentOrder } = await svc
    .from('dd_orders')
    .select('status, shop_id')
    .eq('id', id)
    .single()

  const { data: order, error } = await svc
    .from('dd_orders')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, shop:dd_shops(lat, lng)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // When shop accepts order (pending → confirmed), create delivery and assign driver
  if (currentOrder?.status === 'pending' && body.status === 'confirmed' && order) {
    try {
      // Check if delivery record already exists
      const { data: existingDelivery } = await svc
        .from('dd_deliveries')
        .select('id')
        .eq('order_id', id)
        .maybeSingle()

      let deliveryId: string

      if (existingDelivery) {
        deliveryId = existingDelivery.id
      } else {
        // Calculate distance and earnings
        const shopLat = order.shop?.lat || 0
        const shopLng = order.shop?.lng || 0
        const dropLat = order.delivery_lat || 0
        const dropLng = order.delivery_lng || 0
        const dist = (shopLat && shopLng && dropLat && dropLng)
          ? haversineDistance(shopLat, shopLng, dropLat, dropLng) : 2
        const earnings = calculateDriverEarnings(dist, order.tip || 0)

        const { data: delivery } = await svc
          .from('dd_deliveries')
          .insert({
            order_id: id,
            status: 'pending',
            pickup_lat: order.shop?.lat,
            pickup_lng: order.shop?.lng,
            dropoff_lat: order.delivery_lat,
            dropoff_lng: order.delivery_lng,
            distance_miles: dist,
            driver_earnings: earnings,
            base_pay: 3.00,
          })
          .select()
          .single()

        if (delivery) deliveryId = delivery.id
        else deliveryId = ''
      }

      // Auto-assign nearest driver
      if (deliveryId) {
        await assignNextDriver(deliveryId)
      }
    } catch (err) {
      console.error('Auto-assign driver error:', err)
      // Don't fail the order update if driver assignment fails
    }
  }

  return NextResponse.json({ order })
}
