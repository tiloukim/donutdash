import { NextRequest, NextResponse } from 'next/server'
import { authorizeForShop } from '@/lib/pos-shop-auth'
import { applyOrderTransition } from '@/lib/order-transition'

// POST /api/pos/orders/:id/status — advance an online order from the register.
//
// The POS used to write dd_orders.status straight to Supabase
// (lib/api.advanceOrderStatus), which meant an accept rung up on the Elo never
// dispatched a driver, never emailed the customer, and skipped every transition
// guard. Deliveries only recovered because dispatch-orphan-deliveries sweeps up
// confirmed orders with no delivery row — and that sweep has a 24h window, so a
// scheduled order accepted from the register fell through it entirely.
//
// Cancels do NOT come here: they need the refund path and go to
// /api/pos/orders/:id/cancel.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { shop_id, status } = await req.json().catch(() => ({}))
  if (!shop_id || !status) {
    return NextResponse.json({ error: 'shop_id and status are required' }, { status: 400 })
  }
  if (status === 'cancelled') {
    return NextResponse.json(
      { error: 'Use /api/pos/orders/:id/cancel so the customer is refunded.' },
      { status: 400 },
    )
  }

  const auth = await authorizeForShop(shop_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { svc } = auth

  const { data: order } = await svc
    .from('dd_orders')
    .select('*, shop:dd_shops(lat, lng)')
    .eq('id', id)
    .eq('shop_id', shop_id)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const result = await applyOrderTransition({ svc, order, status })
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status })

  return NextResponse.json({ order: result.order })
}
