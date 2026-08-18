import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { notifyAdmins } from '@/lib/sms'
import { resolveOwnerShop as getActiveShop } from '@/lib/shop-auth'

async function getShopContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthorized' as const }

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) {
    return { error: 'forbidden' as const }
  }

  const shop = await getActiveShop(svc, ddUser.id)
  if (!shop) return { error: 'no_shop' as const }

  return { shop, svc, ddUser }
}

function generateOrderNumber(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return `SO-${code}`
}

export async function POST(req: NextRequest) {
  const ctx = await getShopContext()
  if ('error' in ctx) {
    const status = ctx.error === 'unauthorized' ? 401 : ctx.error === 'forbidden' ? 403 : 404
    return NextResponse.json({ error: ctx.error }, { status })
  }

  const { supplier_name, items_description, quantity_estimate, delivery_date, notes } = await req.json()

  if (!supplier_name || !items_description) {
    return NextResponse.json({ error: 'supplier_name and items_description are required' }, { status: 400 })
  }

  const { svc, shop } = ctx

  // Build a readable notes string that captures all request details
  const noteParts: string[] = [
    `Supplier: ${supplier_name}`,
    `Items: ${items_description}`,
  ]
  if (quantity_estimate) noteParts.push(`Quantity: ${quantity_estimate}`)
  if (delivery_date) noteParts.push(`Preferred delivery: ${delivery_date}`)
  if (notes) noteParts.push(`Notes: ${notes}`)
  const combinedNotes = noteParts.join('\n')

  const orderNumber = generateOrderNumber()
  const { data: order, error: orderErr } = await svc
    .from('dd_supply_orders')
    .insert({
      shop_id: shop.id,
      order_number: orderNumber,
      status: 'pending',
      subtotal: 0,
      margin_total: 0,
      total: 0,
      notes: combinedNotes,
    })
    .select()
    .single()

  if (orderErr || !order) {
    return NextResponse.json({ error: orderErr?.message || 'Failed to create order' }, { status: 500 })
  }

  // Notify admins
  try {
    await notifyAdmins(
      `New supply quote request ${orderNumber} from ${shop.name} — Supplier: ${supplier_name}`,
      `Supply Quote Request ${orderNumber}`,
      `<p>New supply quote request <strong>${orderNumber}</strong> from <strong>${shop.name}</strong></p>` +
      `<pre style="font-family:sans-serif;font-size:14px;line-height:1.7;white-space:pre-wrap;">${combinedNotes}</pre>`,
    )
  } catch {
    // Don't fail the request if notification fails
  }

  return NextResponse.json(order)
}

export async function GET() {
  const ctx = await getShopContext()
  if ('error' in ctx) {
    const status = ctx.error === 'unauthorized' ? 401 : ctx.error === 'forbidden' ? 403 : 404
    return NextResponse.json({ error: ctx.error }, { status })
  }

  const { svc, shop } = ctx

  const { data: orders, error } = await svc
    .from('dd_supply_orders')
    .select('*')
    .eq('shop_id', shop.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(orders || [])
}

export async function PATCH(req: NextRequest) {
  const ctx = await getShopContext()
  if ('error' in ctx) {
    const status = ctx.error === 'unauthorized' ? 401 : ctx.error === 'forbidden' ? 403 : 404
    return NextResponse.json({ error: ctx.error }, { status })
  }

  const { order_id } = await req.json()
  if (!order_id) {
    return NextResponse.json({ error: 'order_id required' }, { status: 400 })
  }

  const { svc, shop } = ctx

  const { data: order } = await svc
    .from('dd_supply_orders')
    .select('*')
    .eq('id', order_id)
    .eq('shop_id', shop.id)
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (order.status !== 'pending') {
    return NextResponse.json({ error: 'Only pending orders can be cancelled' }, { status: 400 })
  }

  const { data: updated, error } = await svc
    .from('dd_supply_orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', order_id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(updated)
}
