import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveCommissionRate } from '@/lib/constants'
import { resolveOwnerShop as getActiveShop } from '@/lib/shop-auth'
import { applyOrderTransition } from '@/lib/order-transition'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const shop = await getActiveShop(svc, ddUser.id)
  if (!shop) return NextResponse.json({ error: 'No shop' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  // The shop "Orders" dashboard is for online order workflow (delivery + pickup
  // that need accept/prep/ready steps). POS walk-in sales are terminal at the
  // register and belong on the POS device's "Today's Sales" view, not here.
  // Bookkeeping/earnings/stats endpoints intentionally do NOT filter and still
  // include walk-ins in their totals.
  // Scheduled orders are HELD, not hidden: a held order is returned with
  // held: true so the dashboard can show it as upcoming (the store needs it to
  // plan production -- and the POS register has always listed them, so hiding
  // them here just made the two surfaces disagree), while the accept controls,
  // the "NEW" styling and the chime stay off until 2h before the slot. Released
  // orders (slot within 2h) then land as fresh "new order" alerts.
  const cutoffMs = Date.now() + 2 * 60 * 60 * 1000

  let query = svc
    .from('dd_orders')
    .select('*, dd_order_items(*), customer:dd_users!customer_id(name, email, phone), delivery:dd_deliveries(delivery_photo_url, pickup_photo_url)')
    .eq('shop_id', shop.id)
    .in('order_type', ['delivery', 'pickup'])
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Only return shop-relevant fields — hide delivery fee, service fee, tips from shop owner
  return NextResponse.json((data || []).map(o => {
    const subtotal = Number(o.subtotal || 0)
    const rate = resolveCommissionRate(o)
    const commission = Math.round(subtotal * rate * 100) / 100
    const shopEarnings = Math.round((subtotal - commission) * 100) / 100
    return {
      id: o.id,
      status: o.status,
      fulfillment_type: o.fulfillment_type || 'delivery',
      subtotal,
      commission,
      shop_earnings: shopEarnings,
      delivery_address: o.delivery_address,
      delivery_instructions: o.delivery_instructions,
      created_at: o.created_at,
      scheduled_for: o.scheduled_for,
      // Still outside its release window — visible for planning, not yet actionable.
      held: !!o.scheduled_for && new Date(o.scheduled_for).getTime() > cutoffMs,
      cancellation_reason: o.cancellation_reason,
      customer: o.customer,
      delivery_photo_url: Array.isArray(o.delivery) ? (o.delivery as any)?.[0]?.delivery_photo_url : (o.delivery as any)?.delivery_photo_url || null,
      pickup_photo_url: Array.isArray(o.delivery) ? (o.delivery as any)?.[0]?.pickup_photo_url : (o.delivery as any)?.pickup_photo_url || null,
      items: (o.dd_order_items || []).map((item: any) => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        special_instructions: item.special_instructions,
        image_url: item.image_url,
      })),
    }
  }))
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin'))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const shop = await getActiveShop(svc, ddUser.id)
  if (!shop) return NextResponse.json({ error: 'No shop' }, { status: 404 })

  const body = await req.json()
  const { order_id, status, cancellation_reason } = body

  if (!order_id || !status) {
    return NextResponse.json({ error: 'order_id and status are required' }, { status: 400 })
  }

  // Get current order and verify it belongs to this shop
  const { data: order } = await svc
    .from('dd_orders')
    .select('*, shop:dd_shops(lat, lng, timezone)')
    .eq('id', order_id)
    .eq('shop_id', shop.id)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const result = await applyOrderTransition({ svc, order, status, cancellation_reason })
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status })


  return NextResponse.json({ order: result.order })
}
