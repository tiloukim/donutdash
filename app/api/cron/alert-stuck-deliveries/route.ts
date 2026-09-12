import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { notifyAdmins } from '@/lib/sms'
import { pushAdmins } from '@/lib/push-server'
import { formatShopDateTime } from '@/lib/time-format'

// Tells an admin when an order has food ready and no driver.
//
// assignNextDriver stops offering after MAX_OFFER_ATTEMPTS and leaves the
// delivery in Available Deliveries for someone to self-claim. If nobody does,
// nothing else notices: cancel-stale-orders only acts once the shop CLOSES,
// and call-unaccepted-orders watches whether the SHOP accepted, not whether a
// driver did. So a paid order could sit for hours with the customer waiting
// and nobody aware.
//
// One alert per delivery (stuck_alerted_at), so this can run every minute
// without becoming noise.

const STUCK_AFTER_MS = 12 * 60 * 1000

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()
  const cutoff = new Date(Date.now() - STUCK_AFTER_MS).toISOString()

  const { data: stuck, error } = await svc
    .from('dd_deliveries')
    .select('id, created_at, order:dd_orders(id, short_code, total, status, scheduled_for, delivery_address, shop:dd_shops(name, timezone))')
    .is('driver_id', null)
    .is('stuck_alerted_at', null)
    .eq('status', 'pending')
    .lte('created_at', cutoff)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!stuck?.length) return NextResponse.json({ alerted: 0 })

  let alerted = 0
  for (const d of stuck) {
    const order = d.order as any
    // Only orders the shop is actually working. A cancelled order, or one the
    // shop hasn't accepted yet, has no driver for good reasons.
    if (!order || !['confirmed', 'preparing', 'ready_for_pickup'].includes(order.status)) continue

    // Claim it first, guarded, so two overlapping runs can't both alert.
    const { data: claimed } = await svc
      .from('dd_deliveries')
      .update({ stuck_alerted_at: new Date().toISOString() })
      .eq('id', d.id)
      .is('stuck_alerted_at', null)
      .select('id')
    if (!claimed?.length) continue

    alerted++
    const shopName = order.shop?.name || 'a shop'
    const mins = Math.round((Date.now() - new Date(d.created_at).getTime()) / 60000)
    const code = order.short_code || String(order.id).slice(0, 8).toUpperCase()
    const slot = order.scheduled_for
      ? ` (scheduled ${formatShopDateTime(order.scheduled_for, order.shop?.timezone)})`
      : ''

    notifyAdmins(
      `NO DRIVER — order #${code} at ${shopName} has been waiting ${mins} min${slot}. $${Number(order.total || 0).toFixed(2)} to ${order.delivery_address || 'customer'}.`,
      `No driver for #${code} — waiting ${mins} min`,
    ).catch(() => {})
    pushAdmins(`No driver — #${code}`, `${shopName} · waiting ${mins} min`).catch(() => {})
  }

  return NextResponse.json({ alerted, checked: stuck.length })
}
