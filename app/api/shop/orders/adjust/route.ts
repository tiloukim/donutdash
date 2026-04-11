import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { order_id, items } = await request.json()
  if (!order_id || !items) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  // Verify order belongs to this shop owner
  const { data: order } = await svc.from('dd_orders')
    .select('id, shop_id, status, shop:dd_shops!inner(owner_id)')
    .eq('id', order_id)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if ((order.shop as any)?.owner_id !== ddUser.id && ddUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (order.status !== 'pending') {
    return NextResponse.json({ error: 'Can only adjust pending orders' }, { status: 400 })
  }

  // Update each item quantity, delete items with qty 0
  for (const item of items) {
    if (item.quantity <= 0) {
      await svc.from('dd_order_items').delete().eq('id', item.id)
    } else {
      await svc.from('dd_order_items').update({ quantity: item.quantity }).eq('id', item.id)
    }
  }

  // Recalculate subtotal from remaining items
  const { data: remainingItems } = await svc.from('dd_order_items')
    .select('price, quantity')
    .eq('order_id', order_id)

  const newSubtotal = (remainingItems || []).reduce((s, i) => s + i.price * i.quantity, 0)
  const roundedSubtotal = Math.round(newSubtotal * 100) / 100

  // Get order to recalculate total
  const { data: fullOrder } = await svc.from('dd_orders')
    .select('tax, delivery_fee, service_fee, tip')
    .eq('id', order_id)
    .single()

  if (fullOrder) {
    const { data: shop } = await svc.from('dd_shops').select('tax_rate, service_fee_pct').eq('id', order.shop_id).single()
    const taxRate = shop?.tax_rate ? shop.tax_rate / 100 : 0
    const feeRate = shop?.service_fee_pct ? shop.service_fee_pct / 100 : 0
    const newTax = Math.round(roundedSubtotal * taxRate * 100) / 100
    const newServiceFee = Math.round(roundedSubtotal * feeRate * 100) / 100
    const newTotal = Math.round((roundedSubtotal + newTax + (fullOrder.delivery_fee || 0) + newServiceFee + (fullOrder.tip || 0)) * 100) / 100

    await svc.from('dd_orders').update({
      subtotal: roundedSubtotal,
      tax: newTax,
      service_fee: newServiceFee,
      total: newTotal,
    }).eq('id', order_id)
  }

  return NextResponse.json({ success: true, subtotal: roundedSubtotal })
}
