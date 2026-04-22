import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'

/**
 * GET /api/stripe/order-lookup?session_id=cs_xxx
 * Look up a dd_orders row by the Stripe payment_intent ID stored in payment_id.
 * Used by the success page to find the order after Stripe webhook creates it.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionId = request.nextUrl.searchParams.get('session_id')
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
    }

    // Retrieve the session from Stripe to get the payment_intent ID
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const paymentIntent = session.payment_intent as string

    if (!paymentIntent) {
      return NextResponse.json({ error: 'No payment intent found' }, { status: 404 })
    }

    // Look up the order by payment_id
    const svc = createServiceClient()
    const { data: order } = await svc
      .from('dd_orders')
      .select('id')
      .eq('payment_id', paymentIntent)
      .single()

    if (!order) {
      // Webhook may not have fired yet — also check by session ID
      const { data: orderBySession } = await svc
        .from('dd_orders')
        .select('id')
        .eq('payment_id', sessionId)
        .single()

      if (orderBySession) {
        return NextResponse.json({ order_id: orderBySession.id })
      }

      return NextResponse.json({ order_id: null })
    }

    return NextResponse.json({ order_id: order.id })
  } catch (err) {
    console.error('Stripe order lookup error:', err)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }
}
