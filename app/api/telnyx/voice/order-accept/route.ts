import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function texml(content: string) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${content}</Response>`,
    { headers: { 'Content-Type': 'application/xml' } },
  )
}
const say = (t: string) => `<Say voice="Azure.en-US-JennyNeural" language="en-US">${t}</Say>`

// TeXML served when the escalation call connects: reads the order and prompts
// the shop to press 1 (accept) or 2 (reject).
async function handle(req: NextRequest) {
  const orderId = new URL(req.url).searchParams.get('order_id') || ''
  const svc = createServiceClient()
  const { data: order } = await svc
    .from('dd_orders')
    .select('total, status, shop:dd_shops(name), dd_order_items(quantity)')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) return texml(say('Sorry, we could not find that order. Goodbye.'))
  if (order.status !== 'confirmed') {
    return texml(say('This order has already been handled. Thank you. Goodbye.'))
  }

  const total = `$${Number(order.total || 0).toFixed(2)}`
  const items = (order.dd_order_items as { quantity?: number }[] | null || []).reduce((s, i) => s + (i.quantity || 1), 0)
  const shopName = (order.shop as { name?: string } | null)?.name || 'your shop'
  const action = `https://donutdash.app/api/telnyx/voice/order-accept-handle?order_id=${encodeURIComponent(orderId)}`

  return texml(`
    <Gather action="${action}" method="POST" numDigits="1" timeout="8">
      ${say(`New Donut Dash order for ${shopName}. ${total}, ${items} item${items === 1 ? '' : 's'}. Press 1 to accept and start preparing. Press 2 to reject the order and refund the customer.`)}
    </Gather>
    ${say('We did not receive a response. Please open your shop app to handle this order. Goodbye.')}
  `)
}

export async function POST(req: NextRequest) { return handle(req) }
export async function GET(req: NextRequest) { return handle(req) }
