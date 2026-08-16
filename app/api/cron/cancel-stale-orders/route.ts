import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { isShopOpen } from '@/lib/shop-hours'
import { refundSquareOrder } from '@/lib/square-refund'
import { sendOrderEmail, buildOrderEmailHtml } from '@/lib/sms'

// Auto-cancel delivery/pickup orders that are still active after their
// shop's closing hour. Runs hourly via vercel cron (vercel.json).
//
// "Active" = pending, confirmed, preparing, ready_for_pickup.
// "Closed" = isShopOpen(shop_id) returns open: false.
//
// Sets status='cancelled' + cancellation_reason='Auto-cancelled: shop closed'
// so the same column the POS already reads from surfaces a real reason
// in order history (donutdash.app/shop/orders) and the POS side panel
// stops showing the order (its filter is ACTIVE_STATUSES only).
//
// Auth: Bearer CRON_SECRET, matching the existing offline-stale-drivers
// pattern. Vercel injects the header automatically for vercel.json crons.

const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready_for_pickup']

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()

  // Find shops that currently have at least one active delivery/pickup
  // order. Far fewer round trips than scanning every shop.
  const { data: activeOrders, error: queryErr } = await svc
    .from('dd_orders')
    .select('id, shop_id')
    .in('order_type', ['delivery', 'pickup'])
    .in('status', ACTIVE_STATUSES)

  if (queryErr) {
    return NextResponse.json({ error: queryErr.message }, { status: 500 })
  }
  if (!activeOrders || activeOrders.length === 0) {
    return NextResponse.json({ checked: 0, cancelled: 0, closedShops: 0 })
  }

  const shopIds = Array.from(new Set(activeOrders.map((o) => o.shop_id)))

  // Check each shop's open state sequentially. Parallel would be faster
  // but business_hours is tiny; sequential keeps the failure mode obvious.
  const closedShops: string[] = []
  for (const shopId of shopIds) {
    try {
      const { open } = await isShopOpen(shopId)
      if (!open) closedShops.push(shopId)
    } catch {
      // Skip shops where isShopOpen fails — don't take down the whole run.
    }
  }

  if (closedShops.length === 0) {
    return NextResponse.json({
      checked: shopIds.length,
      cancelled: 0,
      closedShops: 0,
    })
  }

  // Refund + cancel each affected order. Auto-cancelling a PAID order
  // without issuing a refund is silent charge-without-fulfillment — the
  // customer paid for donuts they'll never get. Refund per order before
  // status flip so a refund failure aborts that order's cancel (the next
  // cron run will retry).
  // Never auto-cancel a future-scheduled order for "shop closed" — the shop
  // will be open at the scheduled slot. Only ASAP / already-due orders qualify.
  const staleNow = new Date().toISOString()
  const { data: toCancel } = await svc
    .from('dd_orders')
    .select('id, total, payment_id, payment_method, customer_id, refund_amount')
    .in('shop_id', closedShops)
    .in('order_type', ['delivery', 'pickup'])
    .in('status', ACTIVE_STATUSES)
    .or(`scheduled_for.is.null,scheduled_for.lte.${staleNow}`)

  const refunded: string[] = []
  const refundFailures: { id: string; error: string }[] = []
  const refundSkipped: string[] = []

  for (const order of toCancel || []) {
    const total = Number(order.total) || 0
    const alreadyRefunded = Number(order.refund_amount) || 0
    const refundable = Math.max(0, total - alreadyRefunded)

    // No payment to refund (free order, comped, or already fully refunded)
    if (refundable <= 0 || !order.payment_id) {
      refundSkipped.push(order.id)
      continue
    }

    let result: { success: boolean; error?: string }
    if (order.payment_method === 'square') {
      result = await refundSquareOrder({
        orderId: order.id,
        paymentId: order.payment_id,
        amountCents: Math.round(refundable * 100),
        reason: 'Auto-cancelled: shop closed',
        idempotencyKey: `cron-stale-refund-${order.id}`,
      })
    } else {
      // Non-Square payment (legacy Stripe / unknown) — can't refund here
      // (Stripe account is closed), so skip the refund but still cancel.
      refundSkipped.push(order.id)
      continue
    }

    if (!result.success) {
      console.error('[CRON CANCEL-STALE] Refund failed', order.id, result.error)
      refundFailures.push({ id: order.id, error: result.error || 'unknown' })
      continue // skip cancel — next run retries
    }

    // Refund succeeded — flip status and stamp refund_amount
    const { error: updErr } = await svc
      .from('dd_orders')
      .update({
        status: 'cancelled',
        cancellation_reason: 'Auto-cancelled: shop closed',
        refund_amount: alreadyRefunded + refundable,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .in('status', ACTIVE_STATUSES) // race guard

    if (updErr) {
      console.error('[CRON CANCEL-STALE] Status update failed', order.id, updErr.message)
      continue
    }

    refunded.push(order.id)

    // Best-effort customer email — never block the cron on email delivery.
    if (order.customer_id) {
      svc.from('dd_users').select('email').eq('id', order.customer_id).maybeSingle().then(({ data }) => {
        if (!data?.email) return
        const html = buildOrderEmailHtml(
          order.id,
          'Your order was cancelled and refunded',
          `We had to cancel order #${order.id.slice(0, 8)} because the shop closed before we could prepare it. $${refundable.toFixed(2)} has been refunded — it should appear in your account in 5–10 business days.`,
        )
        sendOrderEmail(data.email, 'DonutDash order cancelled — refund issued', html).catch(() => {})
      })
    }
  }

  return NextResponse.json({
    checked: shopIds.length,
    closedShops: closedShops.length,
    cancelled: refunded.length,
    refundFailures: refundFailures.length,
    refundSkipped: refundSkipped.length,
    failures: refundFailures,
  })
}
