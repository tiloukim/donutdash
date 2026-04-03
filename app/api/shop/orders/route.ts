import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { assignNextDriver, calculateDriverEarnings } from '@/lib/delivery-assignment'
import { haversineDistance } from '@/lib/osrm'
import { sendOrderEmail, buildOrderEmailHtml } from '@/lib/sms'

// Valid shop-side status transitions
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing'],
  preparing: ['ready_for_pickup'],
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: shop } = await svc.from('dd_shops').select('id').eq('owner_id', ddUser.id).single()
  if (!shop) return NextResponse.json({ error: 'No shop' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  let query = svc.from('dd_orders').select('*, dd_order_items(*), customer:dd_users!customer_id(name, email, phone)').eq('shop_id', shop.id).order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json((data || []).map(o => ({ ...o, items: o.dd_order_items })))
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin'))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: shop } = await svc.from('dd_shops').select('id, lat, lng').eq('owner_id', ddUser.id).single()
  if (!shop) return NextResponse.json({ error: 'No shop' }, { status: 404 })

  const body = await req.json()
  const { order_id, status, cancellation_reason } = body

  if (!order_id || !status) {
    return NextResponse.json({ error: 'order_id and status are required' }, { status: 400 })
  }

  // Get current order and verify it belongs to this shop
  const { data: order } = await svc
    .from('dd_orders')
    .select('*, shop:dd_shops(lat, lng)')
    .eq('id', order_id)
    .eq('shop_id', shop.id)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  // Validate status transition
  const allowed = ALLOWED_TRANSITIONS[order.status]
  if (!allowed || !allowed.includes(status)) {
    return NextResponse.json(
      { error: `Cannot transition from '${order.status}' to '${status}'` },
      { status: 400 }
    )
  }

  // Build update payload
  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (status === 'cancelled' && cancellation_reason) {
    updateData.cancellation_reason = cancellation_reason
  }

  const { data: updated, error } = await svc
    .from('dd_orders')
    .update(updateData)
    .eq('id', order_id)
    .select('*, shop:dd_shops(lat, lng)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Send status update email to customer (fire and forget)
  {
    const { data: customer } = await svc
      .from('dd_users')
      .select('email')
      .eq('id', order.customer_id)
      .single()

    if (customer?.email) {
      const { data: shopInfo } = await svc.from('dd_shops').select('name').eq('id', order.shop_id).single()
      const sName = shopInfo?.name || 'the shop'
      const statusMessages: Record<string, { subject: string; headline: string; message: string }> = {
        confirmed: {
          subject: `Order Accepted - DonutDash #${order_id.slice(0, 8).toUpperCase()}`,
          headline: 'Order Accepted!',
          message: `Great news! Your order has been accepted by ${sName}. They will start preparing it shortly.`,
        },
        preparing: {
          subject: `Order Being Prepared - DonutDash #${order_id.slice(0, 8).toUpperCase()}`,
          headline: 'Your Order is Being Prepared!',
          message: `${sName} is now preparing your order. Hang tight!`,
        },
        ready_for_pickup: {
          subject: `Order Ready - DonutDash #${order_id.slice(0, 8).toUpperCase()}`,
          headline: 'Your Order is Ready!',
          message: 'Your order is ready for pickup! A driver is on the way to pick it up and deliver it to you.',
        },
        cancelled: {
          subject: `Order Cancelled - DonutDash #${order_id.slice(0, 8).toUpperCase()}`,
          headline: 'Order Cancelled',
          message: `We're sorry, your order has been cancelled.${cancellation_reason ? ` Reason: ${cancellation_reason}` : ''} If you were charged, a refund will be processed.`,
        },
      }

      const info = statusMessages[status]
      if (info) {
        const html = buildOrderEmailHtml(order_id, info.headline, info.message)
        sendOrderEmail(customer.email, info.subject, html).catch(() => {})
      }
    }
  }

  // When shop accepts order (pending -> confirmed), create delivery and assign driver
  if (order.status === 'pending' && status === 'confirmed' && updated) {
    try {
      // Check if delivery record already exists
      const { data: existingDelivery } = await svc
        .from('dd_deliveries')
        .select('id')
        .eq('order_id', order_id)
        .maybeSingle()

      let deliveryId = existingDelivery?.id || ''

      if (!existingDelivery) {
        const shopLat = shop.lat || 0
        const shopLng = shop.lng || 0
        const dropLat = updated.delivery_lat || 0
        const dropLng = updated.delivery_lng || 0
        const dist = (shopLat && shopLng && dropLat && dropLng)
          ? haversineDistance(shopLat, shopLng, dropLat, dropLng) : 2
        const earnings = calculateDriverEarnings(dist, updated.tip || 0)

        const { data: delivery } = await svc
          .from('dd_deliveries')
          .insert({
            order_id,
            status: 'pending',
            pickup_lat: shop.lat,
            pickup_lng: shop.lng,
            dropoff_lat: updated.delivery_lat,
            dropoff_lng: updated.delivery_lng,
            distance_miles: dist,
            driver_earnings: earnings,
            base_pay: 3.00,
          })
          .select()
          .single()

        if (delivery) deliveryId = delivery.id
      }

      if (deliveryId) {
        await assignNextDriver(deliveryId)
      }
    } catch (err) {
      console.error('[SHOP ORDER ACCEPT] Auto-assign driver error:', err)
    }
  }

  return NextResponse.json({ order: updated })
}
