import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { isShopOpen } from '@/lib/shop-hours'

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

  // Cancel all active delivery/pickup orders for closed shops in one
  // round trip. Customers see a real reason in their order history.
  const { data: cancelled, error: updateErr } = await svc
    .from('dd_orders')
    .update({
      status: 'cancelled',
      cancellation_reason: 'Auto-cancelled: shop closed',
      updated_at: new Date().toISOString(),
    })
    .in('shop_id', closedShops)
    .in('order_type', ['delivery', 'pickup'])
    .in('status', ACTIVE_STATUSES)
    .select('id')

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({
    checked: shopIds.length,
    closedShops: closedShops.length,
    cancelled: cancelled?.length ?? 0,
  })
}
