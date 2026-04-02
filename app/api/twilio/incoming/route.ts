import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Twilio webhook — called when someone replies to our Twilio number
// Forwards customer replies to the assigned driver's phone
export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const from = formData.get('From') as string  // Customer's phone
  const body = formData.get('Body') as string   // Their message

  if (!from || !body) {
    return twimlResponse('Sorry, we could not process your message.')
  }

  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Find the customer by phone number
  const { data: customer } = await svc.from('dd_users')
    .select('id, name')
    .eq('phone', from)
    .single()

  if (!customer) {
    // Try without +1 prefix or with it
    const altPhone = from.startsWith('+1') ? from.slice(2) : `+1${from}`
    const { data: altCustomer } = await svc.from('dd_users')
      .select('id, name')
      .or(`phone.eq.${from},phone.eq.${altPhone},phone.eq.${from.replace(/^\+1/, '')}`)
      .single()

    if (!altCustomer) {
      return twimlResponse('Thanks for your message! Please contact us through the DonutDash app.')
    }

    // Use altCustomer
    return await forwardToDriver(svc, altCustomer, body, from)
  }

  return await forwardToDriver(svc, customer, body, from)
}

async function forwardToDriver(
  svc: ReturnType<typeof createClient>,
  customer: { id: string; name: string },
  message: string,
  customerPhone: string
) {
  // Find active delivery for this customer
  const { data: delivery } = await svc.from('dd_deliveries')
    .select('id, driver_id, driver:dd_users!driver_id(phone, name)')
    .in('status', ['assigned', 'picked_up', 'delivering'])
    .eq('order.customer_id', customer.id)
    .limit(1)
    .single()

  // Fallback: search via orders
  if (!delivery) {
    const { data: activeOrders } = await svc.from('dd_orders')
      .select('id')
      .eq('customer_id', customer.id)
      .in('status', ['confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'delivering'])
      .limit(1)

    if (activeOrders && activeOrders.length > 0) {
      const { data: del } = await svc.from('dd_deliveries')
        .select('id, driver_id, driver:dd_users!driver_id(phone, name)')
        .eq('order_id', activeOrders[0].id)
        .in('status', ['assigned', 'picked_up', 'delivering'])
        .single()

      if (del) {
        const driverPhone = (del.driver as any)?.phone
        if (driverPhone) {
          await sendSMS(driverPhone, `Customer ${customer.name}: ${message}`)
          return twimlResponse('Your message has been sent to your driver!')
        }
      }
    }

    return twimlResponse('Thanks for your message! No active delivery found. Please contact us through the DonutDash app.')
  }

  const driverPhone = (delivery.driver as any)?.phone
  if (!driverPhone) {
    return twimlResponse('Your message has been received. Your driver will be notified.')
  }

  // Forward to driver
  await sendSMS(driverPhone, `Customer ${customer.name}: ${message}`)

  return twimlResponse('Your message has been sent to your driver!')
}

async function sendSMS(to: string, body: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!
  const authToken = process.env.TWILIO_AUTH_TOKEN!
  const fromNumber = process.env.TWILIO_PHONE_NUMBER!

  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: fromNumber, Body: body }),
  })
}

function twimlResponse(message: string) {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`
  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  })
}
