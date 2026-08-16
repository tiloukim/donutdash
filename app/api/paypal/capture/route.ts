import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { capturePayPalOrder } from '@/lib/paypal'

export async function POST(request: NextRequest) {
  try {
    const { paypalOrderId, orderId } = await request.json()
    if (!paypalOrderId || !orderId) {
      return NextResponse.json({ error: 'Missing paypalOrderId or orderId' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Bind the capture to the caller's own order before moving any money — never
    // let a logged-in user capture/confirm an order they don't own.
    const svc = createServiceClient()
    const { data: ddUser } = await svc.from('dd_users').select('id').eq('auth_id', user.id).single()
    const { data: order } = await svc.from('dd_orders').select('id, customer_id, payment_id').eq('id', orderId).single()
    if (!ddUser || !order || order.customer_id !== ddUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    // Already captured — idempotent, don't double-capture.
    if (order.payment_id) {
      return NextResponse.json({ success: true, status: 'COMPLETED' })
    }

    // Capture payment
    const captureData = await capturePayPalOrder(paypalOrderId)

    if (captureData.status === 'COMPLETED') {
      // Update order status (service client — customer has no UPDATE policy)
      await svc.from('dd_orders').update({
        status: 'confirmed',
        payment_id: paypalOrderId,
      }).eq('id', orderId)

      return NextResponse.json({ success: true, status: 'COMPLETED' })
    } else {
      console.error('PayPal capture not completed:', captureData.status)
      return NextResponse.json({
        error: `Payment not completed. Status: ${captureData.status}`,
      }, { status: 400 })
    }
  } catch (err: any) {
    console.error('PayPal capture error:', err)
    return NextResponse.json({ error: err.message || 'Capture failed' }, { status: 500 })
  }
}
