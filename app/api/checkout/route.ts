import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import Stripe from 'stripe'
import { SERVICE_FEE_RATE, DEFAULT_DELIVERY_FEE } from '@/lib/constants'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-02-25.clover',
  })
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: ddUser } = await supabase
      .from('dd_users')
      .select('id, email, name')
      .eq('auth_id', authUser.id)
      .single()

    if (!ddUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      shopId,
      items,
      delivery_address,
      delivery_city,
      delivery_instructions,
      tip,
    } = body

    if (!shopId || !items || items.length === 0 || !delivery_address) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Fetch shop-specific fees
    const svc = createServiceClient()
    const { data: shop } = await svc.from('dd_shops').select('service_fee_pct, delivery_fee, min_order, tax_rate').eq('id', shopId).single()
    const shopFeeRate = shop ? shop.service_fee_pct / 100 : SERVICE_FEE_RATE
    const shopDeliveryFee = shop ? shop.delivery_fee : DEFAULT_DELIVERY_FEE
    const shopTaxRate = shop?.tax_rate ? shop.tax_rate / 100 : 0

    // Calculate totals
    const subtotal = items.reduce(
      (sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity,
      0
    )
    const tax = Math.round(subtotal * shopTaxRate * 100) / 100
    const deliveryFee = shopDeliveryFee
    const serviceFee = Math.round(subtotal * shopFeeRate * 100) / 100
    const tipAmount = tip || 0
    const total = Math.round((subtotal + tax + deliveryFee + serviceFee + tipAmount) * 100) / 100

    // Create the order in Supabase
    const { data: order, error: orderError } = await supabase
      .from('dd_orders')
      .insert({
        customer_id: ddUser.id,
        shop_id: shopId,
        status: 'pending',
        subtotal,
        tax,
        delivery_fee: deliveryFee,
        service_fee: serviceFee,
        tip: tipAmount,
        total,
        payment_method: 'stripe',
        delivery_address,
        delivery_city: delivery_city || '',
        delivery_instructions: delivery_instructions || null,
      })
      .select()
      .single()

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 })
    }

    // Insert order items
    const orderItems = items.map((item: {
      menu_item_id: string
      name: string
      price: number
      quantity: number
      image_url: string | null
      special_instructions: string | null
    }) => ({
      order_id: order.id,
      menu_item_id: item.menu_item_id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      image_url: item.image_url || null,
      special_instructions: item.special_instructions || null,
    }))

    const { error: itemsError } = await supabase
      .from('dd_order_items')
      .insert(orderItems)

    if (itemsError) {
      await supabase.from('dd_orders').delete().eq('id', order.id)
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    // Create Stripe Checkout Session
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map(
      (item: { name: string; price: number; quantity: number }) => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.name,
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      })
    )

    // Add tax line item
    if (tax > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: 'Sales Tax' },
          unit_amount: Math.round(tax * 100),
        },
        quantity: 1,
      })
    }

    // Add delivery fee line item
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: 'Delivery Fee' },
        unit_amount: Math.round(deliveryFee * 100),
      },
      quantity: 1,
    })

    // Add service fee line item
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: 'Service Fee' },
        unit_amount: Math.round(serviceFee * 100),
      },
      quantity: 1,
    })

    // Add tip line item if any
    if (tipAmount > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: 'Driver Tip' },
          unit_amount: Math.round(tipAmount * 100),
        },
        quantity: 1,
      })
    }

    const stripe = getStripe()
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      customer_email: ddUser.email,
      metadata: {
        order_id: order.id,
        customer_id: ddUser.id,
      },
      success_url: `${origin}/checkout/success?order_id=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart`,
    })

    // Update order with payment session id
    await supabase
      .from('dd_orders')
      .update({ payment_id: session.id })
      .eq('id', order.id)

    return NextResponse.json({ url: session.url, orderId: order.id })
  } catch (err) {
    console.error('Checkout error:', err)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
