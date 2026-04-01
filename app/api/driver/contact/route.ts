import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: driver } = await svc.from('dd_users').select('id, name, role').eq('auth_id', user.id).single()
  if (!driver || (driver.role !== 'driver' && driver.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { delivery_id, message } = await req.json()
  if (!delivery_id || !message) {
    return NextResponse.json({ error: 'Missing delivery_id or message' }, { status: 400 })
  }

  // Get delivery + customer phone
  const { data: delivery } = await svc.from('dd_deliveries')
    .select('id, driver_id, order:dd_orders(customer_id, customer:dd_users!customer_id(phone, name))')
    .eq('id', delivery_id)
    .single()

  if (!delivery || delivery.driver_id !== driver.id) {
    return NextResponse.json({ error: 'Delivery not found' }, { status: 404 })
  }

  const customerPhone = (delivery.order as any)?.customer?.phone
  if (!customerPhone) {
    return NextResponse.json({ error: 'Customer has no phone number' }, { status: 400 })
  }

  // Send SMS via Twilio
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    return NextResponse.json({ error: 'SMS not configured' }, { status: 500 })
  }

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: customerPhone,
        From: fromNumber,
        Body: message,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      return NextResponse.json({ error: err.message || 'SMS failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to send SMS' }, { status: 500 })
  }
}
