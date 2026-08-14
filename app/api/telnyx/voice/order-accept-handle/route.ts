import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { refundSquareOrder } from '@/lib/square-refund'

function texml(content: string) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${content}</Response>`,
    { headers: { 'Content-Type': 'application/xml' } },
  )
}
const say = (t: string) => `<Say voice="Azure.en-US-JennyNeural" language="en-US">${t}</Say>`

// Handles the shop's keypress from the accept/reject IVR.
export async function POST(req: NextRequest) {
  const orderId = new URL(req.url).searchParams.get('order_id') || ''
  let digits = ''
  try {
    const form = await req.formData()
    digits = String(form.get('Digits') || '')
  } catch { /* no body */ }

  const svc = createServiceClient()
  const { data: order } = await svc.from('dd_orders').select('*').eq('id', orderId).maybeSingle()
  if (!order) return texml(say('Sorry, we could not find that order. Goodbye.'))
  // Guard against double-handling (already accepted in-app, cancelled, etc.).
  if (order.status !== 'confirmed') {
    return texml(say('This order has already been handled. Thank you. Goodbye.'))
  }

  if (digits === '1') {
    await svc.from('dd_orders').update({ status: 'preparing', updated_at: new Date().toISOString() }).eq('id', orderId)
    return texml(say('Order accepted. Please start preparing it. Thank you. Goodbye.'))
  }

  if (digits === '2') {
    // Reject: release any driver, cancel + refund the customer.
    await svc.from('dd_deliveries').update({ status: 'cancelled' }).eq('order_id', orderId).neq('status', 'delivered')
    let refunded = false
    if (order.payment_method === 'square') {
      const result = await refundSquareOrder({
        orderId,
        amountCents: Math.round(Number(order.total) * 100),
        reason: 'Order rejected by shop (phone)',
        idempotencyKey: `reject-call-${orderId}`,
      })
      refunded = result.success
      if (!result.success) console.error('[order-accept] refund failed', orderId, result.error)
    }
    await svc.from('dd_orders').update({
      status: 'cancelled',
      cancellation_reason: 'Rejected by shop',
      ...(refunded ? { refund_amount: Number(order.total) } : {}),
      updated_at: new Date().toISOString(),
    }).eq('id', orderId)
    return texml(say('Order rejected. The customer will be refunded. Goodbye.'))
  }

  // Any other key — re-prompt once.
  const action = `https://donutdash.app/api/telnyx/voice/order-accept-handle?order_id=${encodeURIComponent(orderId)}`
  return texml(`
    <Gather action="${action}" method="POST" numDigits="1" timeout="8">
      ${say('Sorry, that was not a valid choice. Press 1 to accept, or 2 to reject and refund the customer.')}
    </Gather>
    ${say('No response received. Please use your shop app. Goodbye.')}
  `)
}
