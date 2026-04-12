import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendEmail, sendSMS } from '@/lib/sms'

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
    .select('id, shop_id, status, subtotal, customer_id, shop:dd_shops!inner(owner_id, name)')
    .eq('id', order_id)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if ((order.shop as any)?.owner_id !== ddUser.id && ddUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (order.status !== 'pending') {
    return NextResponse.json({ error: 'Can only adjust pending orders' }, { status: 400 })
  }

  // Get original items before changes
  const { data: originalItems } = await svc.from('dd_order_items')
    .select('id, name, price, quantity')
    .eq('order_id', order_id)

  // Build change log for customer notification
  const changes: string[] = []
  for (const item of items) {
    const orig = (originalItems || []).find((o: any) => o.id === item.id)
    if (!orig) continue
    if (item.quantity <= 0) {
      changes.push(`Removed: ${orig.name}`)
    } else if (item.quantity !== orig.quantity) {
      changes.push(`${orig.name}: ${orig.quantity} → ${item.quantity}`)
    }
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
    .select('id, name, price, quantity')
    .eq('order_id', order_id)

  const newSubtotal = (remainingItems || []).reduce((s: number, i: any) => s + i.price * i.quantity, 0)
  const roundedSubtotal = Math.round(newSubtotal * 100) / 100

  // Recalculate total
  const { data: fullOrder } = await svc.from('dd_orders')
    .select('tax, delivery_fee, service_fee, tip')
    .eq('id', order_id)
    .single()

  let newTotal = roundedSubtotal
  if (fullOrder) {
    const { data: shop } = await svc.from('dd_shops').select('tax_rate, service_fee_pct').eq('id', order.shop_id).single()
    const taxRate = shop?.tax_rate ? shop.tax_rate / 100 : 0
    const feeRate = shop?.service_fee_pct ? shop.service_fee_pct / 100 : 0
    const newTax = Math.round(roundedSubtotal * taxRate * 100) / 100
    const newServiceFee = Math.round(roundedSubtotal * feeRate * 100) / 100
    newTotal = Math.round((roundedSubtotal + newTax + (fullOrder.delivery_fee || 0) + newServiceFee + (fullOrder.tip || 0)) * 100) / 100

    await svc.from('dd_orders').update({
      subtotal: roundedSubtotal,
      tax: newTax,
      service_fee: newServiceFee,
      total: newTotal,
      status: 'adjusted',
    }).eq('id', order_id)
  }

  // Notify customer about the adjustment
  const { data: customer } = await svc.from('dd_users')
    .select('email, phone, name')
    .eq('id', order.customer_id)
    .single()

  const shopName = (order.shop as any)?.name || 'The shop'
  const orderShort = order_id.slice(0, 8)
  const itemList = (remainingItems || []).map((i: any) => `${i.quantity}× ${i.name} — $${(i.price * i.quantity).toFixed(2)}`).join('\n')
  const changeList = changes.length > 0 ? changes.join(', ') : 'Some items were adjusted'

  if (customer?.phone) {
    await sendSMS(customer.phone,
      `DonutDash: ${shopName} adjusted your order #${orderShort}. ${changeList}. New total: $${newTotal.toFixed(2)}. Please confirm: https://donutdash.app/orders/${order_id}`)
  }

  if (customer?.email) {
    await sendEmail(customer.email, `Your DonutDash order was adjusted — please confirm`,
      `<div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;">
        <div style="text-align:center;margin-bottom:24px"><img src="https://donutdash.app/logo.png" style="height:48px" /></div>
        <h2 style="color:#1A1A2E;text-align:center">Order Adjusted</h2>
        <p style="color:#555;font-size:15px;line-height:1.6;text-align:center">
          <strong>${shopName}</strong> made some changes to your order #${orderShort} due to item availability.
        </p>
        <div style="background:#FEF3C7;border-radius:10px;padding:16px;margin:16px 0">
          <div style="font-weight:700;color:#92400E;margin-bottom:8px">Changes:</div>
          <div style="color:#92400E;font-size:14px">${changes.map(c => `• ${c}`).join('<br/>')}</div>
        </div>
        <div style="background:#f5f5f5;border-radius:10px;padding:16px;margin:16px 0">
          <div style="font-weight:700;color:#333;margin-bottom:8px">Updated Items:</div>
          ${(remainingItems || []).map((i: any) => `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px"><span>${i.quantity}× ${i.name}</span><span>$${(i.price * i.quantity).toFixed(2)}</span></div>`).join('')}
          <div style="border-top:2px solid #ddd;margin-top:12px;padding-top:12px;display:flex;justify-content:space-between;font-weight:800;font-size:16px"><span>New Total</span><span>$${newTotal.toFixed(2)}</span></div>
        </div>
        <p style="color:#555;font-size:14px;text-align:center;margin:20px 0">Please confirm or cancel your adjusted order:</p>
        <div style="text-align:center">
          <a href="https://donutdash.app/orders/${order_id}" style="background:#FF1493;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block">View & Confirm Order</a>
        </div>
        <hr style="border:none;border-top:1px solid #eee;margin:32px 0" />
        <p style="color:#ccc;font-size:11px;text-align:center">DonutDash · donutdash.app</p>
      </div>`)
  }

  return NextResponse.json({ success: true, subtotal: roundedSubtotal, status: 'adjusted' })
}
