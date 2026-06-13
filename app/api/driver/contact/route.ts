import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendSMS } from '@/lib/sms'

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

  // Use the shared sendSMS helper — Telnyx-first (10DLC registered),
  // Twilio fallback. Centralizes E.164 normalization so local-format
  // numbers like "(903) 555-1234" don't 400 from the provider.
  const ok = await sendSMS(customerPhone, message)
  if (!ok) {
    return NextResponse.json({ error: 'Failed to send SMS' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
