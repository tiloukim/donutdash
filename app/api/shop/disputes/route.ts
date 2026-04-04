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

  // Get all disputes for orders belonging to this shop
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
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Filter to only this shop's orders
  const shopDisputes = (disputes || []).filter((d: any) => {
    // The order must belong to this shop — check via a subquery
    return true // We'll filter server-side below
  })

  // We need to verify these disputes are for this shop's orders
  // Get all order IDs for this shop
  const { data: shopOrders } = await svc
    .from('dd_orders')
    .select('id')
    .eq('shop_id', shop.id)

  const shopOrderIds = new Set((shopOrders || []).map((o: any) => o.id))
  const filtered = (disputes || []).filter((d: any) => shopOrderIds.has(d.order_id))

  return NextResponse.json({ disputes: filtered })
}
