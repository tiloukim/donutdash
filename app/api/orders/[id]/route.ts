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
    .select('*, dd_order_items(*), shop:dd_shops(name, address, city, lat, lng), delivery:dd_deliveries(delivery_photo_url)')
    .eq('id', id)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  // Only allow the customer, shop owner, driver, or admin to view
  if (ddUser.role !== 'admin' && order.customer_id !== ddUser.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // delivery can be an array or single object depending on Supabase join
  const delivery = order.delivery as any
  const deliveryPhotoUrl = Array.isArray(delivery)
    ? delivery[0]?.delivery_photo_url || null
    : delivery?.delivery_photo_url || null

  return NextResponse.json({
    ...order,
    items: order.dd_order_items,
    delivery_photo_url: deliveryPhotoUrl,
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

  // Get current order to check status
  const { data: currentOrder } = await svc
    .from('dd_orders')
    .select('status, shop_id, customer_id')
    .eq('id', id)
    .single()

  // Handle customer cancellation
  if (body.action === 'cancel') {
    if (!currentOrder) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    // Only the customer who placed the order can cancel
    if (currentOrder.customer_id !== ddUser.id && ddUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const cancellableStatuses = ['pending', 'confirmed', 'adjusted']
    if (!cancellableStatuses.includes(currentOrder.status)) {
      return NextResponse.json(
        { error: 'Order cannot be cancelled. It is already being prepared or further along.' },
        { status: 400 }
      )
    }
    const { data: cancelled, error: cancelErr } = await svc
      .from('dd_orders')
      .update({
        status: 'cancelled',
        cancellation_reason: body.cancellation_reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()
    if (cancelErr) return NextResponse.json({ error: cancelErr.message }, { status: 500 })

    // Also cancel any associated delivery record
    await svc
      .from('dd_deliveries')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('order_id', id)

    return NextResponse.json({ order: cancelled, cancelled: true })
  }

  if (!currentOrder) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  // Customer can confirm or cancel an adjusted order
  if (currentOrder.status === 'adjusted' && currentOrder.customer_id === ddUser.id) {
    if (body.status === 'confirmed' || body.status === 'cancelled') {
      const { data: updated, error: updateErr } = await svc
        .from('dd_orders')
        .update({
          status: body.status,
          ...(body.cancellation_reason ? { cancellation_reason: body.cancellation_reason } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
      if (body.status === 'cancelled') {
        await svc.from('dd_deliveries').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('order_id', id)
      }
      return NextResponse.json({ order: updated })
    }
  }

  // Only admin or shop owner can update order status
  if (ddUser.role !== 'admin') {
    // Check if user is the shop owner
    const { data: shop } = await svc.from('dd_shops').select('owner_id').eq('id', currentOrder.shop_id).single()
    if (!shop || shop.owner_id !== ddUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Only allow status updates, not arbitrary field changes
  if (!body.status) {
    return NextResponse.json({ error: 'Only status updates are allowed' }, { status: 400 })
  }

  const { data: order, error } = await svc
    .from('dd_orders')
    .update({ status: body.status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, shop:dd_shops(lat, lng)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // When shop accepts order (pending → confirmed), create delivery and assign driver
  if (currentOrder?.status === 'pending' && body.status === 'confirmed' && order) {
    try {
      console.log('[ORDER ACCEPT] Order', id, '- Shop accepted, starting driver assignment')
      console.log('[ORDER ACCEPT] Shop coords:', order.shop?.lat, order.shop?.lng)
      console.log('[ORDER ACCEPT] Delivery coords:', order.delivery_lat, order.delivery_lng)

      // Check if delivery record already exists
      const { data: existingDelivery } = await svc
        .from('dd_deliveries')
        .select('id')
        .eq('order_id', id)
        .maybeSingle()

      let deliveryId: string

      if (existingDelivery) {
        deliveryId = existingDelivery.id
        console.log('[ORDER ACCEPT] Existing delivery found:', deliveryId)
      } else {
        // Calculate distance and earnings
        const shopLat = order.shop?.lat || 0
        const shopLng = order.shop?.lng || 0
        const dropLat = order.delivery_lat || 0
        const dropLng = order.delivery_lng || 0
        const dist = (shopLat && shopLng && dropLat && dropLng)
          ? haversineDistance(shopLat, shopLng, dropLat, dropLng) : 2
        const earnings = calculateDriverEarnings(dist, order.tip || 0)

        console.log('[ORDER ACCEPT] Creating delivery - distance:', dist, 'earnings:', earnings)

        const { data: delivery, error: deliveryError } = await svc
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

        if (deliveryError) {
          console.error('[ORDER ACCEPT] Failed to create delivery:', deliveryError)
          deliveryId = ''
        } else if (delivery) {
          deliveryId = delivery.id
          console.log('[ORDER ACCEPT] Delivery created:', deliveryId)
        } else {
          deliveryId = ''
        }
      }

      // Auto-assign nearest driver
      if (deliveryId) {
        console.log('[ORDER ACCEPT] Calling assignNextDriver for delivery:', deliveryId)
        const result = await assignNextDriver(deliveryId)
        console.log('[ORDER ACCEPT] assignNextDriver result:', result ? 'offer sent' : 'no driver found')
      } else {
        console.log('[ORDER ACCEPT] No delivery ID, skipping driver assignment')
      }
    } catch (err) {
      console.error('[ORDER ACCEPT] Auto-assign driver error:', err)
      // Don't fail the order update if driver assignment fails
    }
  }

  return NextResponse.json({ order })
}
