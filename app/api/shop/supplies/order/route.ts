import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { notifyAdmins } from '@/lib/sms'

async function getShopContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthorized' as const }

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) {
    return { error: 'forbidden' as const }
  }

  const { data: shop } = await svc.from('dd_shops').select('id, name').eq('owner_id', ddUser.id).single()
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

  const { items, notes } = await req.json()

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'No items provided' }, { status: 400 })
  }

  const { svc, shop } = ctx

  // Fetch product details for all items
  const productIds = items.map((i: any) => i.product_id)
  const { data: products, error: prodErr } = await svc
    .from('dd_supply_products')
    .select('*, supplier:dd_suppliers(name)')
    .in('id', productIds)

  if (prodErr || !products) {
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }

  const productMap = new Map(products.map((p: any) => [p.id, p]))

  // Build order items and calculate totals
  let subtotal = 0
  let marginTotal = 0
  const orderItems: any[] = []

  for (const item of items) {
    const product = productMap.get(item.product_id)
    if (!product) continue

    const qty = Math.max(product.min_qty || 1, item.quantity)
    const lineTotal = Number(product.shop_price) * qty
    const lineCost = Number(product.supplier_cost) * qty

    subtotal += lineTotal
    marginTotal += lineTotal - lineCost

    orderItems.push({
      product_id: product.id,
      product_name: product.name,
      supplier_name: product.supplier?.name || 'Unknown',
      quantity: qty,
      unit_price: product.shop_price,
      supplier_cost: product.supplier_cost,
      total: lineTotal,
    })
  }

  const total = subtotal

  // Create order
  const orderNumber = generateOrderNumber()
  const { data: order, error: orderErr } = await svc
    .from('dd_supply_orders')
    .insert({
      shop_id: shop.id,
      order_number: orderNumber,
      status: 'pending',
      subtotal,
      margin_total: marginTotal,
      total,
      notes: notes || null,
    })
    .select()
    .single()

  if (orderErr || !order) {
    return NextResponse.json({ error: orderErr?.message || 'Failed to create order' }, { status: 500 })
  }

  // Insert order items
  const itemsWithOrderId = orderItems.map(item => ({
    ...item,
    order_id: order.id,
  }))

  const { error: itemsErr } = await svc
    .from('dd_supply_order_items')
    .insert(itemsWithOrderId)

  if (itemsErr) {
    return NextResponse.json({ error: itemsErr.message }, { status: 500 })
  }

  // Notify admins
  try {
    await notifyAdmins(
      `New supply order ${orderNumber} from ${shop.name} — $${total.toFixed(2)} (${orderItems.length} items)`,
      `Supply Order ${orderNumber}`,
      `<p>New supply order <strong>${orderNumber}</strong> from <strong>${shop.name}</strong></p><p>Total: $${total.toFixed(2)} | Margin: $${marginTotal.toFixed(2)}</p>`
    )
  } catch {
    // Don't fail the order if notification fails
  }

  return NextResponse.json({ ...order, items: itemsWithOrderId })
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

  // Fetch items for all orders
  if (orders && orders.length > 0) {
    const orderIds = orders.map((o: any) => o.id)
    const { data: allItems } = await svc
      .from('dd_supply_order_items')
      .select('*')
      .in('order_id', orderIds)

    const itemsByOrder = new Map<string, any[]>()
    for (const item of allItems || []) {
      const list = itemsByOrder.get(item.order_id) || []
      list.push(item)
      itemsByOrder.set(item.order_id, list)
    }

    for (const order of orders) {
      order.items = itemsByOrder.get(order.id) || []
    }
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

  // Check order belongs to shop and is pending
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
