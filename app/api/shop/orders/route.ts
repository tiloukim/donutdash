import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { assignNextDriver } from '@/lib/delivery-assignment'
import { haversineDistance } from '@/lib/osrm'
import { sendOrderEmail, buildOrderEmailHtml } from '@/lib/sms'
import { sendPushToUser } from '@/lib/push-server'
import { refundSquareOrder } from '@/lib/square-refund'
import { resolveCommissionRate } from '@/lib/constants'
import { getPayConfig } from '@/lib/pay-config'

// Valid shop-side status transitions
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready_for_pickup', 'cancelled'],
  // 'picked_up' from this endpoint is only valid when fulfillment_type='pickup'
  // (delivery orders get marked picked_up by the driver app instead).
  ready_for_pickup: ['cancelled', 'picked_up'],
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

  // The shop "Orders" dashboard is for online order workflow (delivery + pickup
  // that need accept/prep/ready steps). POS walk-in sales are terminal at the
  // register and belong on the POS device's "Today's Sales" view, not here.
  // Bookkeeping/earnings/stats endpoints intentionally do NOT filter and still
  // include walk-ins in their totals.
  // Hold scheduled orders: don't surface one to the store until 2h before its
  // slot. ASAP orders (scheduled_for null) always show. Released orders (slot
  // within 2h) reappear here as fresh "new order" alerts for the shop.
  const scheduleCutoff = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()

  let query = svc
    .from('dd_orders')
    .select('*, dd_order_items(*), customer:dd_users!customer_id(name, email, phone), delivery:dd_deliveries(delivery_photo_url, pickup_photo_url)')
    .eq('shop_id', shop.id)
    .in('order_type', ['delivery', 'pickup'])
    .or(`scheduled_for.is.null,scheduled_for.lte.${scheduleCutoff}`)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Only return shop-relevant fields — hide delivery fee, service fee, tips from shop owner
  return NextResponse.json((data || []).map(o => {
    const subtotal = Number(o.subtotal || 0)
    const rate = resolveCommissionRate(o)
    const commission = Math.round(subtotal * rate * 100) / 100
    const shopEarnings = Math.round((subtotal - commission) * 100) / 100
    return {
      id: o.id,
      status: o.status,
      fulfillment_type: o.fulfillment_type || 'delivery',
      subtotal,
      commission,
      shop_earnings: shopEarnings,
      delivery_address: o.delivery_address,
      delivery_instructions: o.delivery_instructions,
      created_at: o.created_at,
      scheduled_for: o.scheduled_for,
      cancellation_reason: o.cancellation_reason,
      customer: o.customer,
      delivery_photo_url: Array.isArray(o.delivery) ? (o.delivery as any)?.[0]?.delivery_photo_url : (o.delivery as any)?.delivery_photo_url || null,
      pickup_photo_url: Array.isArray(o.delivery) ? (o.delivery as any)?.[0]?.pickup_photo_url : (o.delivery as any)?.pickup_photo_url || null,
      items: (o.dd_order_items || []).map((item: any) => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        special_instructions: item.special_instructions,
        image_url: item.image_url,
      })),
    }
  }))
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

  // Shops can only mark picked_up on pickup orders — for delivery orders that
  // transition is driven by the driver app's GPS-confirmed pickup.
  if (status === 'picked_up' && order.fulfillment_type !== 'pickup') {
    return NextResponse.json(
      { error: 'Only pickup orders can be marked picked_up from the shop dashboard.' },
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
          message: order.fulfillment_type === 'pickup'
            ? `Your order is ready! Head to ${sName} to pick it up.`
            : 'Your order is ready for pickup! A driver is on the way to pick it up and deliver it to you.',
        },
        picked_up: {
          subject: `Order Complete - DonutDash #${order_id.slice(0, 8).toUpperCase()}`,
          headline: 'Order Picked Up — Enjoy!',
          message: `Thanks for picking up your order from ${sName}. Hope you enjoy it!`,
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

  // When shop cancels an accepted order, refund the customer + cancel delivery
  if (status === 'cancelled' && (order.status === 'confirmed' || order.status === 'preparing' || order.status === 'ready_for_pickup')) {
    // Cancel any active delivery (driver may still be assigned)
    await svc.from('dd_deliveries')
      .update({ status: 'cancelled' })
      .eq('order_id', order_id)
      .neq('status', 'delivered')

    // Refund the customer. Customer payments run through Square (single
    // platform location), so the platform absorbs the gross refund and
    // claws back from the shop's next payout via accounting.
    if (order.payment_method === 'square') {
      const refundCents = Math.round(Number(order.total) * 100)
      const result = await refundSquareOrder({
        orderId: order_id,
        amountCents: refundCents,
        reason: cancellation_reason
          ? `Order cancelled by shop: ${cancellation_reason}`
          : 'Order cancelled by shop',
        idempotencyKey: `refund-shop-cancel-${order_id}`,
      })
      if (result.success) {
        await svc.from('dd_orders').update({
          refund_amount: Number(order.total),
        }).eq('id', order_id)
      } else {
        console.error('Square refund failed for cancelled order', order_id, result.error)
      }
    }
  }

  // When shop accepts order (pending -> confirmed), create delivery and assign driver.
  // Walk-in POS sales (order_type='pos_walkin') must never trigger driver dispatch —
  // there's no customer to deliver to and no address. Defensive check: even if a
  // future change inserts POS rows as 'pending', this block won't run for them.
  if (order.status === 'pending' && status === 'confirmed' && updated && order.order_type !== 'pos_walkin') {
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
        // No coordinate fallback — pay base only when coords are missing rather
        // than invent a 2-mile default that overpays vs the customer's charge.
        const dist = (shopLat && shopLng && dropLat && dropLng)
          ? haversineDistance(shopLat, shopLng, dropLat, dropLng) : 0
        const cfg = await getPayConfig()
        const tip = updated.tip || 0
        const earnings = Math.round((cfg.driverBasePay + dist * cfg.driverPerMile + tip) * 100) / 100

        const { data: delivery, error: deliveryErr } = await svc
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
            base_pay: cfg.driverBasePay,
          })
          .select()
          .single()

        // Don't swallow this — a silent failure here means the order is confirmed
        // but no driver is ever dispatched. Logged so it's visible; the
        // dispatch-orphan-deliveries cron is the backstop that recovers it.
        if (deliveryErr) console.error('[shop/orders] delivery insert failed for order', order_id, deliveryErr.message)
        if (delivery) deliveryId = delivery.id
      }

      if (deliveryId) {
        await assignNextDriver(deliveryId)
      }
    } catch (err) {
      console.error('[SHOP ORDER ACCEPT] Auto-assign driver error:', err)
    }
  }

  // When a delivery order is marked ready for pickup, actively alert a driver
  // NOW. The accept-time offer may have been declined/expired or never found a
  // driver, and nothing else re-triggers dispatch — so without this, a "ready"
  // order can sit unnoticed until a driver happens to spot it in Available
  // Deliveries. Pickup orders (customer collects) and POS walk-ins don't apply.
  if (status === 'ready_for_pickup' && order.fulfillment_type !== 'pickup' && order.order_type !== 'pos_walkin') {
    try {
      const { data: delivery } = await svc
        .from('dd_deliveries')
        .select('id, driver_id')
        .eq('order_id', order_id)
        .neq('status', 'cancelled')
        .maybeSingle()

      if (delivery?.driver_id) {
        // A driver already accepted — alert them in-app (push only; drivers
        // are notified through the app, not SMS).
        const { data: shopInfo } = await svc.from('dd_shops').select('name').eq('id', order.shop_id).single()
        const sName = shopInfo?.name || 'the shop'
        sendPushToUser(delivery.driver_id, {
          title: 'Order Ready for Pickup!',
          body: `Head to ${sName} now to pick up and deliver.`,
          url: '/driver/active',
          tag: 'order-ready',
        }).catch(() => {})
      } else if (delivery) {
        // Still no driver — push a fresh offer now, bypassing the attempt cap
        // (the food is ready, so this is urgent even if earlier offers lapsed).
        await assignNextDriver(delivery.id, { force: true })
      }
    } catch (err) {
      console.error('[SHOP ORDER READY] Driver ready-alert error:', err)
    }
  }

  return NextResponse.json({ order: updated })
}
