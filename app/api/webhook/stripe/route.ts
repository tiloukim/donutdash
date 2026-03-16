import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/server'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-02-25.clover',
  })
}

function getWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET!
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
    }

    let event: Stripe.Event

    try {
      const stripe = getStripe()
      event = stripe.webhooks.constructEvent(body, signature, getWebhookSecret())
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const orderId = session.metadata?.order_id
      const customerId = session.metadata?.customer_id

      if (!orderId) {
        console.error('No order_id in session metadata')
        return NextResponse.json({ error: 'Missing order_id' }, { status: 400 })
      }

      const supabase = createServiceClient()

      // Update order status to confirmed
      const { data: order, error: updateError } = await supabase
        .from('dd_orders')
        .update({
          status: 'confirmed',
          payment_id: session.payment_intent as string || session.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .select('*, shop:dd_shops(*)')
        .single()

      if (updateError) {
        console.error('Failed to update order:', updateError)
        return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
      }

      // Create a delivery record
      if (order) {
        const { error: deliveryError } = await supabase
          .from('dd_deliveries')
          .insert({
            order_id: orderId,
            driver_id: null,
            status: 'pending',
            pickup_lat: order.shop?.lat || null,
            pickup_lng: order.shop?.lng || null,
            dropoff_lat: order.delivery_lat || null,
            dropoff_lng: order.delivery_lng || null,
          })

        if (deliveryError) {
          console.error('Failed to create delivery record:', deliveryError)
          // Don't fail the webhook for this
        }
      }

      console.log(`Order ${orderId} confirmed for customer ${customerId}`)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
