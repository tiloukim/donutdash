import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendOrderEmail, buildOrderEmailHtml } from '@/lib/sms'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'driver' && ddUser.role !== 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { delivery_id, status } = await req.json()

  const validTransitions: Record<string, string[]> = {
    assigned: ['picked_up'],
    picked_up: ['delivering'],
    delivering: ['delivered'],
  }

  // Get current delivery
  const { data: delivery } = await svc.from('dd_deliveries')
    .select('*')
    .eq('id', delivery_id)
    .eq('driver_id', ddUser.id)
    .single()

  if (!delivery) return NextResponse.json({ error: 'Delivery not found' }, { status: 404 })

  const allowed = validTransitions[delivery.status] || []
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: `Cannot transition from ${delivery.status} to ${status}` }, { status: 400 })
  }

  const updateData: any = { status }
  if (status === 'picked_up') updateData.picked_up_at = new Date().toISOString()
  if (status === 'delivered') updateData.delivered_at = new Date().toISOString()

  const { data: updated, error } = await svc.from('dd_deliveries')
    .update(updateData)
    .eq('id', delivery_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sync order status
  const orderStatusMap: Record<string, string> = {
    picked_up: 'picked_up',
    delivering: 'out_for_delivery',
    delivered: 'delivered',
  }

  if (orderStatusMap[status]) {
    await svc.from('dd_orders')
      .update({ status: orderStatusMap[status], updated_at: new Date().toISOString() })
      .eq('id', delivery.order_id)
  }

  // Send delivery status email to customer (fire and forget)
  {
    const { data: orderData } = await svc
      .from('dd_orders')
      .select('id, customer_id')
      .eq('id', delivery.order_id)
      .single()

    if (orderData) {
      const { data: customer } = await svc
        .from('dd_users')
        .select('email')
        .eq('id', orderData.customer_id)
        .single()

      if (customer?.email) {
        const orderId = orderData.id
        const driverMessages: Record<string, { subject: string; headline: string; message: string }> = {
          picked_up: {
            subject: `Order Picked Up - DonutDash #${orderId.slice(0, 8).toUpperCase()}`,
            headline: 'Order Picked Up!',
            message: 'Your order has been picked up by your driver and is heading your way!',
          },
          delivering: {
            subject: `Order On Its Way - DonutDash #${orderId.slice(0, 8).toUpperCase()}`,
            headline: 'Your Order is On Its Way!',
            message: 'Your driver is on the way to deliver your order. Get ready!',
          },
          delivered: {
            subject: `Order Delivered - DonutDash #${orderId.slice(0, 8).toUpperCase()}`,
            headline: 'Order Delivered!',
            message: 'Your order has been delivered. Enjoy your donuts!',
          },
        }

        const info = driverMessages[status]
        if (info) {
          const html = buildOrderEmailHtml(orderId, info.headline, info.message)
          sendOrderEmail(customer.email, info.subject, html).catch(() => {})
        }
      }
    }
  }

  return NextResponse.json(updated)
}
