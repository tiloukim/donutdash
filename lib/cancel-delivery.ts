import { createServiceClient } from '@/lib/supabase/server'
import { sendPushToUser } from '@/lib/push-server'

/**
 * Cancel the delivery attached to an order, and tell the driver.
 *
 * Five paths cancel an order — shop decline, customer cancel, POS decline,
 * the stale-order cron, and the phone IVR's press-2 — and every one of them
 * wrote `dd_deliveries.status = 'cancelled'` directly. None told the driver.
 *
 * So a driver with the order on their screen kept driving to the shop. The
 * delivery silently vanished from /api/driver/active on their next poll, with
 * no explanation and no idea they should stop.
 *
 * Returns the drivers notified, so callers can log it.
 */
export async function cancelDeliveryForOrder(
  orderId: string,
  opts: { reason?: string | null; shopName?: string | null } = {},
): Promise<{ cancelled: number; notified: string[] }> {
  const svc = createServiceClient()

  // Only cancel work that hasn't been completed — a delivered order's row is
  // history, not something to retract.
  const { data: rows } = await svc
    .from('dd_deliveries')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .neq('status', 'delivered')
    .neq('status', 'cancelled')
    .select('id, driver_id')

  const cancelled = rows?.length ?? 0
  const notified: string[] = []

  for (const r of rows || []) {
    if (!r.driver_id) continue
    notified.push(r.driver_id)
    const where = opts.shopName ? ` at ${opts.shopName}` : ''
    sendPushToUser(r.driver_id, {
      title: 'Delivery cancelled',
      body: opts.reason
        ? `The order${where} was cancelled: ${opts.reason}. Don't collect it.`
        : `The order${where} was cancelled. Don't collect it.`,
      url: '/driver',
      tag: `delivery-cancelled-${r.id}`,
    }).catch(() => {})
  }

  return { cancelled, notified }
}
