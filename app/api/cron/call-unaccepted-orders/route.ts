import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { callShopToAccept } from '@/lib/voice'

// If a shop hasn't accepted a new delivery order (still 'confirmed', not moved
// to preparing/cancelled) ~60s after it was placed, phone the shop and run the
// press-1-accept / press-2-reject IVR. One call per order (accept_call_at).
// Runs every minute (so calls land ~60–120s after the order, cron-granular).
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()
  const now = Date.now()
  const olderThan = new Date(now - 60 * 1000).toISOString()     // placed >60s ago
  const notAncient = new Date(now - 30 * 60 * 1000).toISOString() // and within 30 min

  const { data: orders } = await svc
    .from('dd_orders')
    .select('id, total, scheduled_for, shop:dd_shops(name, phone, owner:dd_users!owner_id(phone))')
    .eq('fulfillment_type', 'delivery')
    .neq('order_type', 'pos_walkin')
    .eq('status', 'confirmed')
    .is('accept_call_at', null)
    .lte('created_at', olderThan)
    .gte('created_at', notAncient)

  let called = 0
  for (const o of orders || []) {
    // Held scheduled orders aren't "live" for the shop yet — skip until released.
    if (o.scheduled_for && new Date(o.scheduled_for).getTime() - now > 2 * 60 * 60 * 1000) continue

    const shop = o.shop as { name?: string; phone?: string; owner?: { phone?: string } | null } | null
    const phone = shop?.phone || shop?.owner?.phone
    if (!phone) continue

    // Mark called first so an overlapping run can't double-dial.
    await svc.from('dd_orders').update({ accept_call_at: new Date().toISOString() }).eq('id', o.id)
    const ok = await callShopToAccept(phone, o.id)
    if (ok) called++
  }

  return NextResponse.json({ called, checked: orders?.length ?? 0 })
}
