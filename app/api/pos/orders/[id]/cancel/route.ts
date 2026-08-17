import { NextRequest, NextResponse } from 'next/server'
import { authorizeForShop } from '@/lib/pos-shop-auth'
import { refundSquareOrder } from '@/lib/square-refund'

// POST /api/pos/orders/:id/cancel  — cancel an online order from the POS,
// refunding the customer and cancelling any in-flight delivery. The POS used
// to cancel via a direct dd_orders update (no refund, no delivery cleanup),
// which left a paid customer charged. This routes it through the same
// refund + delivery-cancel logic the shop web dashboard uses.
//
// Only cancellable BEFORE the food leaves the shop — once a driver has picked
// up (picked_up/delivering) or it's delivered, cancelling is a support case.
const CANCELABLE = ['pending', 'confirmed', 'preparing', 'ready_for_pickup']

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { shop_id, reason } = await req.json().catch(() => ({}))
  if (!shop_id) return NextResponse.json({ error: 'shop_id is required' }, { status: 400 })

  const auth = await authorizeForShop(shop_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { svc } = auth

  const { data: order } = await svc
    .from('dd_orders')
    .select('id, status, total, payment_method, payment_id, shop_id')
    .eq('id', id)
    .eq('shop_id', shop_id)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.status === 'cancelled') return NextResponse.json({ success: true, alreadyCancelled: true })
  if (!CANCELABLE.includes(order.status)) {
    return NextResponse.json(
      { error: `This order is already ${order.status.replace(/_/g, ' ')} and can't be cancelled here — contact DonutDash support.` },
      { status: 400 },
    )
  }

  // Cancel any active delivery so a driver isn't left holding it.
  await svc.from('dd_deliveries')
    .update({ status: 'cancelled' })
    .eq('order_id', id)
    .neq('status', 'delivered')

  // Refund the customer (online orders are charged through Square at checkout).
  let refunded = false
  let refundError: string | undefined
  if (order.payment_method === 'square' && Number(order.total) > 0) {
    const result = await refundSquareOrder({
      orderId: id,
      paymentId: order.payment_id,
      amountCents: Math.round(Number(order.total) * 100),
      reason: reason ? `Order cancelled by shop: ${reason}` : 'Order cancelled by shop',
      idempotencyKey: `refund-pos-cancel-${id}`,
    })
    refunded = result.success
    if (result.success) {
      await svc.from('dd_orders').update({ refund_amount: Number(order.total) }).eq('id', id)
    } else {
      refundError = result.error
      console.error('[pos/cancel] Square refund failed for', id, result.error)
    }
  }

  const { error } = await svc.from('dd_orders')
    .update({ status: 'cancelled', cancellation_reason: reason ?? null, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, refunded, refundError })
}
