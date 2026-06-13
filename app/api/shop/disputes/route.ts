import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: shop } = await svc.from('dd_shops').select('id').eq('owner_id', ddUser.id).single()
  if (!shop) return NextResponse.json({ error: 'No shop' }, { status: 404 })

  // Filter to this shop in the SQL query, not in JS — the previous
  // pattern fetched EVERY dispute in the system (across all shops) and
  // post-filtered, which both wasted bandwidth and risked cross-shop
  // PII leakage if any future logging dumped the raw response.
  const { data: shopOrders } = await svc
    .from('dd_orders')
    .select('id')
    .eq('shop_id', shop.id)
  const shopOrderIds = (shopOrders || []).map((o: { id: string }) => o.id)

  if (shopOrderIds.length === 0) {
    return NextResponse.json({ disputes: [] })
  }

  const { data: disputes, error } = await svc
    .from('dd_disputes')
    .select(`
      *,
      customer:dd_users!customer_id(name, email, phone),
      order:dd_orders!order_id(id, subtotal, total, delivery_address, created_at, status,
        items:dd_order_items(name, quantity, price),
        delivery:dd_deliveries(delivery_photo_url)
      )
    `)
    .in('order_id', shopOrderIds)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ disputes: disputes || [] })
}
