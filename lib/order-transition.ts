import type { SupabaseClient } from '@supabase/supabase-js'
import { assignNextDriver } from '@/lib/delivery-assignment'
import { haversineDistance } from '@/lib/osrm'
import { sendOrderEmail, buildOrderEmailHtml } from '@/lib/sms'
import { sendPushToUser } from '@/lib/push-server'
import { refundSquareOrder } from '@/lib/square-refund'
import { getPayConfig } from '@/lib/pay-config'

// The single implementation of "a store moved an online order forward".
//
// This used to live only inside /api/shop/orders PATCH, so the POS took a
// shortcut: contexts/OnlineOrdersContext -> lib/api.advanceOrderStatus wrote
// dd_orders.status straight to Supabase. Every accept rung up on the register
// therefore skipped driver dispatch, the customer's status email, transition
// validation, and the refund-on-cancel path -- deliveries only recovered at all
// because dispatch-orphan-deliveries sweeps up orders with no delivery row.
// Both callers now go through here so the two paths can't drift again.

// Valid shop-side status transitions
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready_for_pickup', 'cancelled'],
  // 'picked_up' from this endpoint is only valid when fulfillment_type='pickup'
  // (delivery orders get marked picked_up by the driver app instead).
  ready_for_pickup: ['cancelled', 'picked_up'],
}

type Svc = SupabaseClient<any, any, any>

export type TransitionResult =
  | { error: string; status: number; order?: undefined }
  | { error?: undefined; status?: undefined; order: any }

/**
 * Applies a shop-side status transition and every side effect that goes with
 * it: customer status email, refund + delivery cancel on cancel, driver
 * dispatch when fulfillment starts, and the ready-for-pickup driver alert.
 *
 * `order` must be the current row, already fetched and authorized for the
 * caller's shop, selected as `'*, shop:dd_shops(lat, lng)'`.
 */
export async function applyOrderTransition({
  svc,
  order,
  status,
  cancellation_reason,
}: {
  svc: Svc
  order: any
  status: string
  cancellation_reason?: string | null
}): Promise<TransitionResult> {
  const order_id = order.id as string

  // Validate status transition
  const allowed = ALLOWED_TRANSITIONS[order.status]
  if (!allowed || !allowed.includes(status)) {
    return { error: `Cannot transition from '${order.status}' to '${status}'`, status: 400 }
  }

  // A scheduled order still outside its 2h release window is not the store's to
  // start yet. Accepting it is what dispatches a driver, so an early accept
  // would send a driver to collect an order days before it's baked. Both the
  // dashboard and the register show held orders as read-only "SCHEDULED"; this
  // is the server-side backstop, and the reason order f2910e04 sat 'confirmed'
  // four days before its slot with no driver and no alert.
  const heldUntil = order.scheduled_for
    ? new Date(order.scheduled_for).getTime() - 2 * 60 * 60 * 1000
    : null
  if (heldUntil !== null && Date.now() < heldUntil && status !== 'cancelled') {
    return {
      error: `This order is scheduled for ${new Date(order.scheduled_for).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}. It becomes available to accept 2 hours before that slot.`,
      status: 400,
    }
  }

  // Shops can only mark picked_up on pickup orders — for delivery orders that
  // transition is driven by the driver app's GPS-confirmed pickup.
  if (status === 'picked_up' && order.fulfillment_type !== 'pickup') {
    return { error: 'Only pickup orders can be marked picked_up from the register or shop dashboard.', status: 400 }
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

  if (error) return { error: error.message, status: 500 }

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
        paymentId: order.payment_id,
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

  // Dispatch a driver when the shop starts fulfilling a DELIVERY order: the
  // normal accept (pending -> confirmed), OR a released scheduled order the shop
  // begins preparing (confirmed -> preparing). Scheduled orders are never
  // dispatched at checkout, so without the second case they never get a driver.
  // Walk-in POS sales and pickup orders never dispatch a driver.
  const startsFulfillment =
    (order.status === 'pending' && status === 'confirmed') ||
    (order.status === 'confirmed' && status === 'preparing')
  if (startsFulfillment && updated && order.order_type !== 'pos_walkin' && order.fulfillment_type !== 'pickup') {
    try {
      // Check if delivery record already exists
      const { data: existingDelivery } = await svc
        .from('dd_deliveries')
        .select('id')
        .eq('order_id', order_id)
        .maybeSingle()

      // A normal order already has a delivery (dispatched at checkout/accept),
      // so moving it to 'preparing' must NOT re-offer it. Only act on preparing
      // when there's no delivery yet — i.e. a released scheduled order.
      if (existingDelivery && status === 'preparing') {
        // already dispatched — nothing to do
      } else {
      let deliveryId = existingDelivery?.id || ''

      if (!existingDelivery) {
        const shopLat = order.shop?.lat || 0
        const shopLng = order.shop?.lng || 0
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
            pickup_lat: order.shop?.lat ?? null,
            pickup_lng: order.shop?.lng ?? null,
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
        if (deliveryErr) console.error('[order-transition] delivery insert failed for order', order_id, deliveryErr.message)
        if (delivery) deliveryId = delivery.id
      }

      if (deliveryId) {
        await assignNextDriver(deliveryId)
      }
      }
    } catch (err) {
      console.error('[ORDER TRANSITION ACCEPT] Auto-assign driver error:', err)
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
      console.error('[ORDER TRANSITION READY] Driver ready-alert error:', err)
    }
  }

  return { order: updated }
}
