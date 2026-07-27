import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { notifyAdmins, sendSMS, sendOrderEmail, buildOrderEmailHtml } from '@/lib/sms'

// Releases "held" scheduled orders to the store ~2h before their slot: flips
// the paid, still-pending order to 'confirmed' and fires the shop + admin
// new-order notifications. The status flip is the dedupe — once confirmed a
// later run won't re-select it. Runs every minute via vercel.json cron.
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

  // Held orders now within the lead window: paid, still 'pending', scheduled.
  const { data: due, error } = await svc
    .from('dd_orders')
    .select('id, total, shop_id, scheduled_for')
    .eq('status', 'pending')
    .not('payment_id', 'is', null)
    .not('scheduled_for', 'is', null)
    .lte('scheduled_for', cutoff)
    .in('order_type', ['delivery', 'pickup'])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!due || due.length === 0) return NextResponse.json({ released: 0 })

  let released = 0
  for (const order of due) {
    // Flip to confirmed FIRST (guarded on status='pending') so an overlapping
    // run can never double-release / double-notify the same order.
    const { data: flipped, error: upErr } = await svc
      .from('dd_orders')
      .update({ status: 'confirmed' })
      .eq('id', order.id)
      .eq('status', 'pending')
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
  }

  return NextResponse.json({ released })
}
