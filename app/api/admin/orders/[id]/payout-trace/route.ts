import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canAccessAdminPortal } from '@/lib/admin-auth'
import { resolveCommissionRate } from '@/lib/constants'

export const dynamic = 'force-dynamic'

// GET /api/admin/orders/[id]/payout-trace
//
// Returns the full per-order money waterfall: what the customer paid,
// what Stripe took, what the shop received, what the platform retained,
// what the driver gets paid, and what's left for the platform after
// driver payout + tax remittance.
//
// Live-fetches the Stripe BalanceTransaction so processing fees come
// from Stripe directly rather than being estimated. Falls back to a
// 2.9% + $0.30 estimate when Stripe lookup fails.

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: caller } = await svc
    .from('dd_users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!caller || !canAccessAdminPortal(caller.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: order } = await svc
    .from('dd_orders')
    .select(`
      id, short_code, status, order_type, payment_method, payment_id,
      subtotal, tax, delivery_fee, service_fee, tip, total, refund_amount,
      promo_discount, commission_pct, created_at, shop_id,
      customer:dd_users!customer_id(id, name, email),
      shop:dd_shops!shop_id(id, name, owner_id),
      delivery:dd_deliveries(driver_id, driver_earnings, base_pay, distance_miles, status, delivered_at,
        driver:dd_users!driver_id(id, name, email)
      )
    `)
    .eq('id', id)
    .maybeSingle()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const subtotal = Number(order.subtotal || 0)
  const tax = Number(order.tax || 0)
  const deliveryFee = Number(order.delivery_fee || 0)
  const serviceFee = Number(order.service_fee || 0)
  const tip = Number(order.tip || 0)
  const total = Number(order.total || 0)
  const refundAmount = Number(order.refund_amount || 0)
  const promoDiscount = Number(order.promo_discount || 0)
  const commissionRate = resolveCommissionRate(order)
  const commission = +(subtotal * commissionRate).toFixed(2)
  const shopGross = +(subtotal - commission).toFixed(2)

  // Refund proportional split (same shape used in /api/admin/payouts).
  const refundRatio = refundAmount > 0 && total > 0 ? Math.min(refundAmount / total, 1) : 0
  const effShop = +(shopGross * (1 - refundRatio)).toFixed(2)
  const effCommission = +(commission * (1 - refundRatio)).toFixed(2)
  const effDelivery = +(deliveryFee * (1 - refundRatio)).toFixed(2)
  const effService = +(serviceFee * (1 - refundRatio)).toFixed(2)
  const effTip = +(tip * (1 - refundRatio)).toFixed(2)
  const effTax = +(tax * (1 - refundRatio)).toFixed(2)

  const deliveryRaw = (order.delivery as { driver_id?: string; driver_earnings?: number; base_pay?: number; distance_miles?: number; status?: string; delivered_at?: string; driver?: { id?: string; name?: string; email?: string } } | null)
  const driverEarnings = Number(deliveryRaw?.driver_earnings || 0)
  const driverBasePay = Number(deliveryRaw?.base_pay || 0)
  const driverDistMiles = Number(deliveryRaw?.distance_miles || 0)

  // Look up the actual Stripe processing fee. If anything fails we fall
  // back to the standard US Stripe published rate so the waterfall still
  // renders — admin can refresh later or check Stripe directly.
  // Application fee = customer total minus what the shop earns. Processing
  // fees settle inside the Square account and aren't broken out per order.
  const applicationFee = +(total - shopGross).toFixed(2)
  const platformGross = applicationFee
  const platformNet = +(platformGross - driverEarnings - effTax - refundAmount).toFixed(2)

  // Downstream payout status — has this order's earnings been included
  // in a weekly batch yet?
  const { data: payoutItems } = await svc
    .from('dd_payout_items')
    .select('id, batch_id, kind, amount, status, paid_at, batch:dd_payout_batches(week_start, week_end, status)')
    .or(`order_id.eq.${order.id}`)
    .order('paid_at', { ascending: false })

  return NextResponse.json({
    order: {
      id: order.id,
      short_code: order.short_code,
      status: order.status,
      order_type: order.order_type,
      created_at: order.created_at,
      payment_method: order.payment_method,
      payment_id: order.payment_id,
      customer: order.customer,
      shop: order.shop,
      delivery: deliveryRaw,
    },
    customer: {
      paid: total,
      composition: {
        subtotal,
        tax,
        delivery_fee: deliveryFee,
        service_fee: serviceFee,
        tip,
        promo_discount: promoDiscount,
      },
    },
    splits: {
      shop_gross: shopGross,
      commission,
      commission_rate_pct: +(commissionRate * 100).toFixed(2),
      effective_shop: effShop,
      effective_commission: effCommission,
      effective_delivery_fee: effDelivery,
      effective_service_fee: effService,
      effective_tip: effTip,
      effective_tax: effTax,
      refund_amount: refundAmount,
      refund_ratio_pct: +(refundRatio * 100).toFixed(2),
      driver_earnings: driverEarnings,
      driver_base_pay: driverBasePay,
      driver_distance_miles: driverDistMiles,
      driver_tip_passthrough: effTip,
      application_fee: applicationFee,
      platform_gross: platformGross,
      platform_net_keep: platformNet,
    },
    payouts: {
      items: (payoutItems || []).map(p => ({
        id: p.id,
        kind: p.kind,
        amount: p.amount,
        status: p.status,
        paid_at: p.paid_at,
        week_start: (p.batch as { week_start?: string } | null)?.week_start || null,
        week_end: (p.batch as { week_end?: string } | null)?.week_end || null,
        batch_status: (p.batch as { status?: string } | null)?.status || null,
      })),
    },
  })
}
