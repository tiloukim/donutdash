import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

    // Capture payment
    const captureData = await capturePayPalOrder(paypalOrderId)

    if (captureData.status === 'COMPLETED') {
      // Update order status
      await supabase.from('dd_orders').update({
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
