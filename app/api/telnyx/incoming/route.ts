import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendSMS } from '@/lib/sms'

// Telnyx webhook — called when someone texts our Telnyx number
// Forwards customer replies to the assigned driver's phone
export async function POST(req: NextRequest) {
  const json = await req.json()
  const event = json.data

  // Only handle inbound messages
  if (event?.event_type !== 'message.received') {
    return NextResponse.json({ ok: true })
  }

  const payload = event.payload
  const from = payload?.from?.phone_number as string
  const body = payload?.text as string

  if (!from || !body) {
    return NextResponse.json({ ok: true })
  }

  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Find the customer by phone number (try multiple formats)
  const altPhone = from.startsWith('+1') ? from.slice(2) : `+1${from}`
  const { data: customer } = await svc.from('dd_users')
    .select('id, name')
    .or(`phone.eq.${from},phone.eq.${altPhone},phone.eq.${from.replace(/^\+1/, '')}`)
    .limit(1)
    .single()

  if (!customer) {
    return NextResponse.json({ ok: true })
  }

  // Find active order for this customer
  const { data: activeOrders } = await svc.from('dd_orders')
    .select('id')
    .eq('customer_id', customer.id)
    .in('status', ['confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'delivering'])
    .limit(1)

  if (!activeOrders || activeOrders.length === 0) {
    return NextResponse.json({ ok: true })
  }

  const { data: del } = await svc.from('dd_deliveries')
    .select('id, driver_id, driver:dd_users!driver_id(phone, name)')
    .eq('order_id', activeOrders[0].id)
    .in('status', ['assigned', 'picked_up', 'delivering'])
    .single()

  if (!del) {
    return NextResponse.json({ ok: true })
  }

  const driverPhone = (del as any).driver?.phone
  if (driverPhone) {
    await sendSMS(driverPhone, `Customer ${customer.name}: ${body}`)
  }

  return NextResponse.json({ ok: true })
}
