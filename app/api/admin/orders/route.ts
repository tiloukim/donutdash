import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canAccessAdminPortal } from '@/lib/admin-auth'
import { resolveCommissionRate, BASE_DELIVERY_PAY, PER_MILE_PAY } from '@/lib/constants'
import { computeProcessingFee, computeAdminProfit, DEFAULT_PROCESSOR_PCT, DEFAULT_PROCESSOR_FLAT } from '@/lib/processing-fee'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()
    const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
    if (!ddUser || !canAccessAdminPortal(ddUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: orders, error } = await svc
      .from('dd_orders')
      .select(`
        *,
        customer:dd_users!customer_id(name, email),
        shop:dd_shops!shop_id(name, lat, lng, commission_pct),
        items:dd_order_items(name, price, quantity),
        delivery:dd_deliveries(driver_earnings, driver_id, status, base_pay, distance_miles, delivery_photo_url, pickup_photo_url, driver:dd_users!driver_id(name, avatar_url))
      `)
      // Delivery-business view only. POS walk-ins have entirely different
      // economics — no commission, no driver, no service/delivery fee; the
      // shop pays its processor directly — but this page applies the
      // delivery model to every row it's given. A walk-in was therefore
      // shown with a 20% commission it never paid and, because its status
      // is 'delivered', a synthesised $3.00 driver estimate from the
      // fallback below. Four test sales alone distorted Net Admin Profit by
      // -$9.44, growing ~$3 per POS sale.
      //
      // Walk-in sales are reported in the POS app's own Reports screen,
      // which accounts for processor fees instead.
      .in('order_type', ['delivery', 'pickup'])
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Trust the stored driver_earnings — that's what the weekly payout cron will actually pay.
    // Only fall back to a recompute if the stored value is missing/zero (legacy or in-flight rows).
    // Processor rates, platform-wide. Read once per request rather than per
    // order; a missing row falls back to the observed Square effective rate.
    const { data: rateRows } = await svc
      .from('dd_platform_settings')
      .select('key, value')
      .in('key', ['payment_processor_pct', 'payment_processor_flat'])
    const rateMap = new Map((rateRows || []).map(r => [r.key, Number(r.value)]))
    const rates = {
      pct: Number.isFinite(rateMap.get('payment_processor_pct')!) ? rateMap.get('payment_processor_pct')! : DEFAULT_PROCESSOR_PCT,
      flat: Number.isFinite(rateMap.get('payment_processor_flat')!) ? rateMap.get('payment_processor_flat')! : DEFAULT_PROCESSOR_FLAT,
    }

    const enrichedOrders = (orders || []).map(order => {
      const delivery = Array.isArray(order.delivery) ? (order.delivery as any)?.[0] : (order.delivery as any)
      const tip = order.tip || 0

      if (delivery) {
        const stored = Number(delivery.driver_earnings) || 0
        if (stored > 0) return order
        // No stored value — recompute from current constants and stored distance.
        const dist = Number(delivery.distance_miles) || 0
        delivery.driver_earnings = Math.round((BASE_DELIVERY_PAY + dist * PER_MILE_PAY + tip) * 100) / 100
      } else if (
        order.order_type === 'delivery' &&
        order.status !== 'cancelled' &&
        order.status !== 'pending'
      ) {
        // No delivery row yet — show an estimate so the table still renders
        // a number. Gated to order_type 'delivery': a pickup has no driver
        // and never will, so estimating pay for one invents a cost.
        const estimated = Math.round((BASE_DELIVERY_PAY + tip) * 100) / 100
        ;(order as any).delivery = [{ driver_earnings: estimated, driver_id: null, status: 'estimated', driver: null }]
      }
      return order
    })

    // Attach the money the page used to recompute in three places (the table
    // cell, the detail row, and the summary card) from slightly different
    // expressions. One source now, and it nets off processing.
    const withProfit = enrichedOrders.map((order: any) => {
      const delivery = Array.isArray(order.delivery) ? order.delivery?.[0] : order.delivery
      const processingFee = computeProcessingFee(Number(order.total) || 0, order.payment_method, rates)
      const adminProfit = computeAdminProfit({
        subtotal: Number(order.subtotal) || 0,
        commissionRate: resolveCommissionRate(order),
        serviceFee: Number(order.service_fee) || 0,
        deliveryFee: Number(order.delivery_fee) || 0,
        smallOrderFee: Number(order.small_order_fee) || 0,
        tip: Number(order.tip) || 0,
        driverEarnings: Number(delivery?.driver_earnings) || 0,
        processingFee,
      })
      return { ...order, processing_fee: processingFee, admin_profit: adminProfit }
    })

    return NextResponse.json({ orders: withProfit, processorRates: rates })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
