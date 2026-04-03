import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST: Add item to group order
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const svc = createServiceClient()

    const { data: dbUser } = await svc
      .from('dd_users')
      .select('id, name')
      .eq('auth_id', authUser.id)
      .single()

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { group_order_id, menu_item_id, name, price, quantity, special_instructions } = await req.json()

    if (!group_order_id || !menu_item_id || !name || price == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check group order exists and is open
    const { data: groupOrder } = await svc
      .from('dd_group_orders')
      .select('id, status')
      .eq('id', group_order_id)
      .single()

    if (!groupOrder) {
      return NextResponse.json({ error: 'Group order not found' }, { status: 404 })
    }

    if (groupOrder.status !== 'open') {
      return NextResponse.json({ error: 'Group order is no longer accepting items' }, { status: 400 })
    }

    const { data: item, error } = await svc
      .from('dd_group_order_items')
      .insert({
        group_order_id,
        user_id: dbUser.id,
        user_name: dbUser.name,
        menu_item_id,
        name,
        price,
        quantity: quantity || 1,
        special_instructions: special_instructions || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to add item:', error)
      return NextResponse.json({ error: 'Failed to add item' }, { status: 500 })
    }

    return NextResponse.json({ item })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: Remove item from group order
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const svc = createServiceClient()

    const { data: dbUser } = await svc
      .from('dd_users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single()

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { item_id } = await req.json()
    if (!item_id) {
      return NextResponse.json({ error: 'item_id is required' }, { status: 400 })
    }

    // Get the item and its group order
    const { data: item } = await svc
      .from('dd_group_order_items')
      .select('*, dd_group_orders!inner(host_id, status)')
      .eq('id', item_id)
      .single()

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Only the item owner or the host can delete
    const groupOrder = (item as Record<string, unknown>).dd_group_orders as { host_id: string; status: string }
    if (item.user_id !== dbUser.id && groupOrder.host_id !== dbUser.id) {
      return NextResponse.json({ error: 'Not authorized to remove this item' }, { status: 403 })
    }

    if (groupOrder.status !== 'open') {
      return NextResponse.json({ error: 'Group order is locked' }, { status: 400 })
    }

    const { error } = await svc
      .from('dd_group_order_items')
      .delete()
      .eq('id', item_id)

    if (error) {
      return NextResponse.json({ error: 'Failed to remove item' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
