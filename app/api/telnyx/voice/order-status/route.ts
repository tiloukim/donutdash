import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function texml(content: string) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${content}</Response>`,
    { headers: { 'Content-Type': 'application/xml' } }
  )
}

const STATUS_MESSAGES: Record<string, string> = {
  pending: 'Your order is pending and waiting to be confirmed by the shop.',
  confirmed: 'Your order has been confirmed by the shop and is being prepared.',
  preparing: 'Your order is currently being prepared.',
  ready_for_pickup: 'Your order is ready for pickup!',
  picked_up: 'Your order has been picked up by a driver and is on its way.',
  out_for_delivery: 'Your order is out for delivery and will arrive soon.',
  delivered: 'Your order has been delivered. Enjoy your donuts!',
  cancelled: 'This order has been cancelled.',
  refunded: 'This order has been refunded.',
}

export async function POST(req: NextRequest) {
  const body = await req.formData().catch(() => null)
  const params = body ? Object.fromEntries(body.entries()) : await req.json().catch(() => ({}))
  const digits = (params.Digits || params.digits || '').toString().toLowerCase()

  if (!digits || digits.length < 4) {
    return texml(`
      <Say voice="Telnyx.Ultra.3e1ed423-17e5-4773-b87c-25b031106e41" language="en-US">
        Sorry, we couldn't find that order. Please make sure you entered the correct order number.
      </Say>
      <Redirect method="POST">https://donutdash.app/api/telnyx/voice</Redirect>
    `)
  }

  try {
    const svc = createServiceClient()

    // Search for order by partial ID match
    const { data: orders } = await svc.from('dd_orders')
      .select('id, status, total, created_at, shop:dd_shops(name)')
      .ilike('id', `${digits}%`)
      .order('created_at', { ascending: false })
      .limit(1)

    if (!orders || orders.length === 0) {
      return texml(`
        <Say voice="Telnyx.Ultra.3e1ed423-17e5-4773-b87c-25b031106e41" language="en-US">
          Sorry, we couldn't find an order matching that number.
          Please double-check your order number and try again, or visit donut dash dot app to check your order online.
        </Say>
        <Redirect method="POST">https://donutdash.app/api/telnyx/voice</Redirect>
      `)
    }

    const order = orders[0]
    const shopName = (order.shop as any)?.name || 'the shop'
    const statusMsg = STATUS_MESSAGES[order.status] || `The current status is: ${order.status}.`
    const total = Number(order.total).toFixed(2)
    const shortId = order.id.slice(0, 8).toUpperCase()

    return texml(`
      <Say voice="Telnyx.Ultra.3e1ed423-17e5-4773-b87c-25b031106e41" language="en-US">
        We found your order. Order number ${shortId.split('').join(' ')}, from ${shopName}, totaling $${total}.
        ${statusMsg}
        To return to the main menu, press 9. To check another order, press 1.
      </Say>
      <Gather action="https://donutdash.app/api/telnyx/voice" method="POST" numDigits="1" timeout="5"/>
      <Say voice="Telnyx.Ultra.3e1ed423-17e5-4773-b87c-25b031106e41" language="en-US">Thank you for calling DonutDash. Goodbye!</Say>
      <Hangup/>
    `)
  } catch {
    return texml(`
      <Say voice="Telnyx.Ultra.3e1ed423-17e5-4773-b87c-25b031106e41" language="en-US">
        Sorry, we're having trouble looking up your order right now. Please try again later or check online at donut dash dot app.
      </Say>
      <Redirect method="POST">https://donutdash.app/api/telnyx/voice</Redirect>
    `)
  }
}
