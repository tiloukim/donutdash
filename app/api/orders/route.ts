import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the dd_users record
    const { data: ddUser } = await supabase
      .from('dd_users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single()

    if (!ddUser) {
      return NextResponse.json({ orders: [] })
    }

    const { data: orders, error } = await supabase
      .from('dd_orders')
      .select('*, shop:dd_shops(*), items:dd_order_items(*)')
      .eq('customer_id', ddUser.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ orders: orders || [] })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
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
      .select('id')
      .eq('auth_id', authUser.id)
      .single()

    if (!ddUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      shop_id,
      items,
      subtotal,
      delivery_fee,
      service_fee,
      tip,
      total,
      delivery_address,
      delivery_city,
      delivery_instructions,
      payment_id,
    } = body

    const { data: order, error: orderError } = await supabase
      .from('dd_orders')
      .insert({
        customer_id: ddUser.id,
        shop_id,
        status: 'pending',
        subtotal,
        delivery_fee,
        service_fee,
        tip: tip || 0,
        total,
        delivery_address,
        delivery_city,
        delivery_instructions: delivery_instructions || null,
        payment_id: payment_id || null,
        payment_method: 'square',
      })
      .select()
      .single()

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 })
    }

    // Insert order items
    if (items && items.length > 0) {
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
        // Clean up the order if items fail
        await supabase.from('dd_orders').delete().eq('id', order.id)
        return NextResponse.json({ error: itemsError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ order }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
