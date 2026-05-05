import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { BASE_DELIVERY_PAY, PER_MILE_PAY } from '@/lib/constants'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()
    const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
    if (!ddUser || ddUser.role !== 'admin' && ddUser.role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: orders, error } = await svc
      .from('dd_orders')
      .select(`
        *,
        customer:dd_users!customer_id(name, email),
        shop:dd_shops!shop_id(name, lat, lng),
        items:dd_order_items(name, price, quantity),
        delivery:dd_deliveries(driver_earnings, driver_id, status, base_pay, distance_miles, delivery_photo_url, driver:dd_users!driver_id(name))
      `)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Trust the stored driver_earnings — that's what the weekly payout cron will actually pay.
    // Only fall back to a recompute if the stored value is missing/zero (legacy or in-flight rows).
    const enrichedOrders = (orders || []).map(order => {
      const delivery = Array.isArray(order.delivery) ? (order.delivery as any)?.[0] : (order.delivery as any)
      const tip = order.tip || 0

      if (delivery) {
        const stored = Number(delivery.driver_earnings) || 0
        if (stored > 0) return order
        // No stored value — recompute from current constants and stored distance.
        const dist = Number(delivery.distance_miles) || 0
        delivery.driver_earnings = Math.round((BASE_DELIVERY_PAY + dist * 2 * PER_MILE_PAY + tip) * 100) / 100
      } else if (order.status !== 'cancelled' && order.status !== 'pending') {
        // No delivery row yet — show an estimate so the table still renders a number.
        const estimated = Math.round((BASE_DELIVERY_PAY + tip) * 100) / 100
        ;(order as any).delivery = [{ driver_earnings: estimated, driver_id: null, status: 'estimated', driver: null }]
      }
      return order
    })

    return NextResponse.json({ orders: enrichedOrders })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
