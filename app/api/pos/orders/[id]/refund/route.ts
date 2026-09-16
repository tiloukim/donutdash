import { NextRequest, NextResponse } from 'next/server'
import { authorizeForShop } from '@/lib/pos-shop-auth'

// POST /api/pos/orders/:id/refund  { shop_id, refund_amount, reason? }
//
// Record a refund on a walk-in sale. The MONEY has already moved by the time
// this is called — cash out of the drawer, or a void/return already approved
// by the gateway. This is the ledger write only.
//
// It exists because the POS wrote it client-side, and a full refund sets
// status = 'cancelled', which dd-orders-status-server-only.sql refuses from
// an app session. That guard is right: status changes belong on the server.
// But the failure landed AFTER the gateway had already refunded the customer,
// so the money went back and the books didn't know — a $1.40 card refund on
// order 34DD2 had to be reconciled by hand.
//
// Idempotent on the amount, not additive: refund_amount is the running TOTAL
// refunded against the sale, which is what the client already computes
// (existing + this one). Retrying a request that actually succeeded therefore
// writes the same number rather than doubling it — and a retry after a
// timeout is exactly the case this has to survive.

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const shopId = body.shop_id as string | undefined
  if (!shopId) return NextResponse.json({ error: 'shop_id is required' }, { status: 400 })

  const refundAmount = Number(body.refund_amount)
  if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
    return NextResponse.json({ error: 'refund_amount must be a positive number' }, { status: 400 })
  }

  const auth = await authorizeForShop(shopId)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { svc } = auth

  const { data: order } = await svc
    .from('dd_orders')
    .select('id, shop_id, total, refund_amount, status, order_type')
    .eq('id', id)
    .eq('shop_id', shopId)
    .maybeSingle()

  if (!order) return NextResponse.json({ error: 'Sale not found' }, { status: 404 })

  const total = Number(order.total || 0)
  const rounded = Math.round(refundAmount * 100) / 100
  // Half a cent of tolerance: the client sums existing + new in floating
  // point, and rejecting a full refund over 0.001 would be absurd.
  if (rounded > total + 0.005) {
    return NextResponse.json(
      { error: `Refund of $${rounded.toFixed(2)} exceeds the sale total of $${total.toFixed(2)}` },
      { status: 400 },
    )
  }

  const isFull = Math.abs(rounded - total) < 0.005
  const patch: Record<string, unknown> = {
    refund_amount: rounded,
    updated_at: new Date().toISOString(),
  }
  // Only a FULL refund cancels the sale. A partial leaves it delivered — the
  // customer kept some of what they bought, and reports count it accordingly.
  if (isFull) patch.status = 'cancelled'

  const { error } = await svc.from('dd_orders').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, refund_amount: rounded, fullRefund: isFull })
}
