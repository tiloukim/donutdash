import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()
    const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
    if (!ddUser || ddUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: orders, error } = await svc
      .from('dd_orders')
      .select(`
        *,
        customer:dd_users!customer_id(name, email),
        shop:dd_shops!shop_id(name, lat, lng),
        items:dd_order_items(name, price, quantity),
        delivery:dd_deliveries(driver_earnings, driver_id, status, base_pay, distance_miles, driver:dd_users!driver_id(name))
      `)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Recalculate driver earnings if stored as 0 or null
    const enrichedOrders = (orders || []).map(order => {
      let delivery = (order.delivery as any)?.[0]
      const tip = order.tip || 0

      if (delivery) {
        // Delivery exists but earnings is 0/null — recalculate
        if (!delivery.driver_earnings || delivery.driver_earnings === 0) {
          const basePay = delivery.base_pay || 2.50
          const dist = delivery.distance_miles || 2
          delivery.driver_earnings = Math.round((basePay + dist * 0.55 + tip) * 100) / 100
        }
      } else if (order.status !== 'cancelled' && order.status !== 'pending') {
        // No delivery record — estimate driver pay for display
        const dist = 2 // default estimate
        const estimated = Math.round((2.50 + dist * 0.55 + tip) * 100) / 100
        ;(order as any).delivery = [{ driver_earnings: estimated, driver_id: null, status: 'estimated', driver: null }]
      }
      return order
    })

    return NextResponse.json({ orders: enrichedOrders })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
