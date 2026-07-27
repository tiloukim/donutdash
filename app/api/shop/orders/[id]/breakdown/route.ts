import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canAccessAdminPortal } from '@/lib/admin-auth'
import { resolveCommissionRate } from '@/lib/constants'

export const dynamic = 'force-dynamic'

// GET /api/shop/orders/[id]/breakdown
//
// Shop-facing money waterfall for one order — drives the breakdown
// modal on /shop/earnings. Authorized to:
//   - the shop owner of the shop that owns the order (shop slice only)
//   - admins (platform slice included, same fields as the admin
//     /api/admin/orders/[id]/payout-trace endpoint)
//
// Shape mirrors the admin endpoint so the UI can render one component
// regardless of viewer role — `platform` is just omitted for non-admins.

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
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const isAdmin = canAccessAdminPortal(caller.role)
  const isShopOwner = caller.role === 'shop_owner'
  if (!isAdmin && !isShopOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: order } = await svc
    .from('dd_orders')
    .select(`
      id, short_code, status, order_type, payment_method, payment_id,
      subtotal, tax, delivery_fee, service_fee, tip, total, refund_amount,
      promo_discount, commission_pct, created_at, shop_id,
      shop:dd_shops!shop_id(id, name, owner_id)
    `)
    .eq('id', id)
    .maybeSingle()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  // Non-admin shop owners may only see their own shop's orders.
  const shopRow = order.shop as unknown as { owner_id?: string; name?: string } | null
  if (!isAdmin) {
    if (!shopRow || shopRow.owner_id !== caller.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

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

  // Refund proportional split (same shape used in admin payout-trace).
  const refundRatio = refundAmount > 0 && total > 0 ? Math.min(refundAmount / total, 1) : 0
  const effShop = +(shopGross * (1 - refundRatio)).toFixed(2)
  const effCommission = +(commission * (1 - refundRatio)).toFixed(2)
  const effDelivery = +(deliveryFee * (1 - refundRatio)).toFixed(2)
  const effService = +(serviceFee * (1 - refundRatio)).toFixed(2)
  const effTip = +(tip * (1 - refundRatio)).toFixed(2)
  const effTax = +(tax * (1 - refundRatio)).toFixed(2)

  const shopPayload = {
    order: {
      id: order.id,
      short_code: order.short_code,
      status: order.status,
      order_type: order.order_type,
      created_at: order.created_at,
      shop_name: shopRow?.name ?? null,
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
    shop: {
      gross: shopGross,
      commission,
      commission_rate_pct: +(commissionRate * 100).toFixed(2),
      effective_payout: effShop,
      effective_commission: effCommission,
      refund_amount: refundAmount,
      refund_ratio_pct: +(refundRatio * 100).toFixed(2),
    },
  }

  if (!isAdmin) {
    return NextResponse.json(shopPayload)
  }

  // Platform slice (admin viewers). Processing fees settle inside the Square
  // account and aren't broken out per order, so platform_gross is the
  // pre-processing-fee application fee.
  const applicationFee = +(total - shopGross).toFixed(2)
  const platformGross = applicationFee

  return NextResponse.json({
    ...shopPayload,
    platform: {
      application_fee: applicationFee,
      platform_gross: platformGross,
      effective_delivery_fee: effDelivery,
      effective_service_fee: effService,
      effective_tip: effTip,
      effective_tax: effTax,
    },
  })
}
