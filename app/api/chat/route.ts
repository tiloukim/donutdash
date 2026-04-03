import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const orderId = request.nextUrl.searchParams.get('order_id')
    if (!orderId) return NextResponse.json({ error: 'Missing order_id' }, { status: 400 })

    const svc = createServiceClient()

    // Look up dd_users record
    const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
    if (!ddUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Verify user is either the customer on this order or the assigned driver
    const { data: order } = await svc.from('dd_orders').select('id, customer_id').eq('id', orderId).single()
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const isCustomer = order.customer_id === ddUser.id

    const { data: delivery } = await svc.from('dd_deliveries')
      .select('driver_id')
      .eq('order_id', orderId)
      .single()

    const isDriver = delivery?.driver_id === ddUser.id

    if (!isCustomer && !isDriver) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch messages
    const { data: messages, error } = await svc
      .from('dd_chat_messages')
      .select('id, sender_id, sender_role, message, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ messages: messages || [], user_id: ddUser.id })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { order_id, message } = await request.json()
    if (!order_id || !message?.trim()) {
      return NextResponse.json({ error: 'Missing order_id or message' }, { status: 400 })
    }

    const svc = createServiceClient()

    const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
    if (!ddUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Verify user is customer or assigned driver
    const { data: order } = await svc.from('dd_orders').select('id, customer_id, status').eq('id', order_id).single()
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    // Only allow chat on active orders
    const activeStatuses = ['confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'delivering']
    if (!activeStatuses.includes(order.status)) {
      return NextResponse.json({ error: 'Chat is only available for active orders' }, { status: 400 })
    }

    const isCustomer = order.customer_id === ddUser.id

    const { data: delivery } = await svc.from('dd_deliveries')
      .select('driver_id')
      .eq('order_id', order_id)
      .single()

    const isDriver = delivery?.driver_id === ddUser.id

    if (!isCustomer && !isDriver) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const senderRole = isCustomer ? 'customer' : 'driver'

    const { data: newMsg, error } = await svc
      .from('dd_chat_messages')
      .insert({
        order_id,
        sender_id: ddUser.id,
        sender_role: senderRole,
        message: message.trim(),
      })
      .select('id, sender_id, sender_role, message, created_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ message: newMsg })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
