import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { notifyAdmins, sendSMS, sendOrderEmail, buildOrderEmailHtml } from '@/lib/sms'
import { pushAdmins } from '@/lib/push-server'

// Releases "held" scheduled orders to the store ~2h before their slot and
// fires the shop + admin new-order notifications. Runs every minute via
// vercel.json cron.
//
// The release deliberately LEAVES the order 'pending'. A released scheduled
// order has to look exactly like a fresh one to the store: the shop dashboard
// and the POS side panel both key their "NEW order" chime, pulsing card, and
// Accept button off status='pending', and the shop's Accept (pending ->
// confirmed) is what dispatches a driver. Flipping to 'confirmed' here — as
// this cron used to — released the order silently: no chime, no Accept, and no
// driver until someone noticed it by hand.
//
// Dedupe is released_at (see supabase/scheduled-order-release.sql), set under a
// released_at IS NULL guard so overlapping runs can't double-notify. Using a
// dedicated marker instead of the status flip also means an order confirmed
// early (admin action, manual edit) is no longer permanently disqualified from
// being announced.
//
// Auth: Bearer CRON_SECRET (Vercel injects it for vercel.json crons).

const RELEASE_LEAD_MS = 2 * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()
  const cutoff = new Date(Date.now() + RELEASE_LEAD_MS).toISOString()

  // Held orders now within the lead window: paid, scheduled, not yet released.
  // Status is intentionally NOT part of the filter — an order someone confirmed
  // early still needs its release announcement.
  const { data: due, error } = await svc
    .from('dd_orders')
    .select('id, total, shop_id, scheduled_for, fulfillment_type, order_type')
    .is('released_at', null)
    .not('payment_id', 'is', null)
    .not('scheduled_for', 'is', null)
    .lte('scheduled_for', cutoff)
    .in('status', ['pending', 'confirmed'])
    .in('order_type', ['delivery', 'pickup'])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!due || due.length === 0) return NextResponse.json({ released: 0 })

  let released = 0
  for (const order of due) {
    // Stamp released_at FIRST (guarded on released_at IS NULL) so an
    // overlapping run can never double-release / double-notify the same order.
    const { data: flipped, error: upErr } = await svc
      .from('dd_orders')
      .update({ released_at: new Date().toISOString() })
      .eq('id', order.id)
      .is('released_at', null)
      .select('id')
    if (upErr || !flipped || flipped.length === 0) continue

    released++

    const { data: shop } = await svc.from('dd_shops').select('name, owner_id').eq('id', order.shop_id).single()
    const shopName = shop?.name || 'your shop'
    const total = Number(order.total || 0).toFixed(2)
    const when = order.scheduled_for
      ? new Date(order.scheduled_for).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : 'soon'

    if (shop?.owner_id) {
      const { data: owner } = await svc.from('dd_users').select('email, phone').eq('id', shop.owner_id).single()
      if (owner?.phone) {
        const sms = `DonutDash scheduled order now due (${when}) — $${total}. Open your shop app to accept: donutdash.app/shop/orders`
        sendSMS(owner.phone.startsWith('+') ? owner.phone : `+1${owner.phone.replace(/\D/g, '')}`, sms).catch(() => {})
      }
      if (owner?.email) {
        const html = buildOrderEmailHtml(
          order.id,
          `Scheduled order due — ${shopName}`,
          `A scheduled order for ${when} ($${total}) is now ready to prepare. Open your shop app to accept it.`,
          '',
        )
        sendOrderEmail(owner.email, `Scheduled Order Due - DonutDash #${order.id.slice(0, 8).toUpperCase()}`, html).catch(() => {})
      }
    }

    notifyAdmins(
      `Scheduled order due (${when}) — $${total} from ${shopName}`,
      `Scheduled Order Due: $${total} from ${shopName}`,
    ).catch(() => {})
    // Checkout pushes admins for every ASAP order; without this the release
    // path was the one new-order event that never reached an admin device.
    pushAdmins(
      `Scheduled Order Due — $${total}`,
      `${shopName} · ${when}`,
    ).catch(() => {})
  }

  return NextResponse.json({ released })
}
