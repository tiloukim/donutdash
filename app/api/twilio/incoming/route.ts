import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Twilio webhook — called when someone replies to our Twilio number
// Forwards customer replies to the assigned driver's phone
export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const from = formData.get('From') as string
  const body = formData.get('Body') as string

  if (!from || !body) {
    return twimlResponse('Sorry, we could not process your message.')
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
    return twimlResponse('Thanks for your message! Please contact us through the DonutDash app.')
  }

  // Find active order for this customer
  const { data: activeOrders } = await svc.from('dd_orders')
    .select('id')
    .eq('customer_id', customer.id)
    .in('status', ['confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'delivering'])
    .limit(1)

  if (!activeOrders || activeOrders.length === 0) {
    return twimlResponse('Thanks for your message! No active delivery found.')
  }

  const { data: del } = await svc.from('dd_deliveries')
    .select('id, driver_id, driver:dd_users!driver_id(phone, name)')
    .eq('order_id', activeOrders[0].id)
    .in('status', ['assigned', 'picked_up', 'delivering'])
    .single()

  if (!del) {
    return twimlResponse('Thanks for your message! Your driver has not been assigned yet.')
  }

  const driverPhone = (del as any).driver?.phone
  if (!driverPhone) {
    return twimlResponse('Your message has been received. Your driver will be notified.')
  }

  await sendSMS(driverPhone, `Customer ${customer.name}: ${body}`)
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
