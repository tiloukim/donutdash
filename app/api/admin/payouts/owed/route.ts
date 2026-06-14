import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canAccessAdminPortal, isAdmin } from '@/lib/admin-auth'
import { getStripe } from '@/lib/stripe'
import { BASE_DELIVERY_PAY, PER_MILE_PAY } from '@/lib/constants'

export const dynamic = 'force-dynamic'

// GET /api/admin/payouts/owed
//
// Reconciliation view: what does the platform actually have on Stripe
// right now, vs. what's already earmarked for drivers + tax remittance.
// Returns a single struct the UI can render as cards.
//
// "True keep" = Stripe balance (available + pending) − driver owed − tax owed.
// Doesn't include Mercury balance — that's separate (we don't poll Mercury
// here). Once Stripe pays out to Mercury, those obligations get paid FROM
// Mercury, so the math holds: platform's actual liquidity is anchored to
// the larger pool (Stripe + Mercury combined) minus the same obligations.

export async function GET() {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('role').eq('auth_id', user.id).maybeSingle()
  // Sensitive financial reconciliation — admin + general only. Field
  // and marketing managers shouldn't see platform cash position.
  if (!ddUser || !canAccessAdminPortal(ddUser.role) || !(isAdmin(ddUser.role) || ddUser.role === 'general_manager')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 1) Live Stripe balance
  let stripeAvailable = 0
  let stripePending = 0
  let stripeError: string | null = null
  try {
    const stripe = getStripe()
    const bal = await stripe.balance.retrieve()
    for (const a of bal.available) if (a.currency === 'usd') stripeAvailable += a.amount
    for (const p of bal.pending) if (p.currency === 'usd') stripePending += p.amount
    stripeAvailable = +(stripeAvailable / 100).toFixed(2)
    stripePending = +(stripePending / 100).toFixed(2)
  } catch (err) {
    stripeError = err instanceof Error ? err.message : 'Stripe balance fetch failed'
  }

  // 2) Driver owed — sum delivered driver_earnings minus already-paid
  // payout_items (kind='driver', status='paid') minus already-paid
  // payout_requests (status='paid').
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString()
  const [deliveriesRes, payoutItemsRes, payoutRequestsRes] = await Promise.all([
    svc.from('dd_deliveries')
      .select('id, driver_id, driver_earnings, base_pay, distance_miles, order:dd_orders(tip)')
      .eq('status', 'delivered'),
    svc.from('dd_payout_items')
      .select('amount, kind, status')
      .eq('kind', 'driver')
      .eq('status', 'paid'),
    svc.from('dd_payout_requests')
      .select('amount, role, status')
      .eq('status', 'paid'),
  ])

  const totalDriverEarned = (deliveriesRes.data ?? []).reduce((sum, d) => {
    const stored = Number(d.driver_earnings) || 0
    if (stored > 0) return sum + stored
    // Legacy fallback for rows that never got snapshotted earnings
    const basePay = Number(d.base_pay) || BASE_DELIVERY_PAY
    const tip = Number((d.order as { tip?: number } | null)?.tip || 0)
    const miles = Number(d.distance_miles) || 0
    return sum + +(basePay + miles * PER_MILE_PAY + tip).toFixed(2)
  }, 0)
  const totalDriverPaidViaBatches = (payoutItemsRes.data ?? []).reduce((s, p) => s + Number(p.amount), 0)
  const totalDriverPaidViaInstant = (payoutRequestsRes.data ?? [])
    .filter(p => p.role === 'driver')
    .reduce((s, p) => s + Number(p.amount), 0)
  const driverOwed = Math.max(0, +(totalDriverEarned - totalDriverPaidViaBatches - totalDriverPaidViaInstant).toFixed(2))

  // 3) Tax collected this year (delivery+pickup only — walk-ins remit
  // their own tax directly via the shop's POS records). Refund-
  // proportional adjustment to match the rest of the accounting code.
  const { data: ordersForTax } = await svc.from('dd_orders')
    .select('tax, total, refund_amount')
    .neq('status', 'cancelled')
    .in('order_type', ['delivery', 'pickup'])
    .gte('created_at', yearStart)
  const totalTaxCollected = (ordersForTax ?? []).reduce((sum, o) => {
    const tax = Number(o.tax || 0)
    const total = Number(o.total || 0)
    const refund = Number(o.refund_amount || 0)
    if (refund <= 0 || total <= 0) return sum + tax
    return sum + Math.max(0, tax * (1 - Math.min(refund / total, 1)))
  }, 0)
  const taxOwed = +totalTaxCollected.toFixed(2) // No remittance tracking yet — assume nothing remitted

  // 4) Shop owed — what shops haven't been paid out yet (similar
  // pattern, shop_owner side of the same payout tables).
  const { data: ordersForShop } = await svc.from('dd_orders')
    .select('subtotal, total, refund_amount, commission_pct, shop_id')
    .eq('status', 'delivered')
    .in('order_type', ['delivery', 'pickup'])
  const totalShopEarned = (ordersForShop ?? []).reduce((sum, o) => {
    const subtotal = Number(o.subtotal || 0)
    const total = Number(o.total || 0)
    const refund = Number(o.refund_amount || 0)
    const refundRatio = refund > 0 && total > 0 ? Math.min(refund / total, 1) : 0
    const effSub = Math.max(0, subtotal * (1 - refundRatio))
    const commissionPct = o.commission_pct != null ? Number(o.commission_pct) / 100 : 0.20
    return sum + effSub * (1 - commissionPct)
  }, 0)
  const totalShopPaidViaBatches = await svc.from('dd_payout_items')
    .select('amount')
    .eq('kind', 'shop')
    .eq('status', 'paid')
    .then(r => (r.data ?? []).reduce((s, p) => s + Number(p.amount), 0))
  // Note: Stripe Connect destination charges transfer shop payouts
  // INSTANTLY to the shop's Connect account (not via our batch system).
  // So the "shop owed" number tracked here is for pickup orders or any
  // legacy non-Connect flow. With Connect on for all shops, this should
  // stay near $0.
  const shopOwed = Math.max(0, +(totalShopEarned - totalShopPaidViaBatches).toFixed(2))

  const stripeTotal = +(stripeAvailable + stripePending).toFixed(2)
  const trueKeep = +(stripeTotal - driverOwed - taxOwed).toFixed(2)

  return NextResponse.json({
    stripe: {
      available: stripeAvailable,
      pending: stripePending,
      total: stripeTotal,
      error: stripeError,
    },
    obligations: {
      driver_owed: driverOwed,
      driver_total_earned: +totalDriverEarned.toFixed(2),
      driver_paid_via_batches: +totalDriverPaidViaBatches.toFixed(2),
      driver_paid_via_instant: +totalDriverPaidViaInstant.toFixed(2),
      tax_owed: taxOwed,
      tax_year: new Date().getFullYear(),
      shop_owed: shopOwed, // Should be ~$0 for Connect-enabled shops
    },
    net_position: {
      stripe_minus_obligations: trueKeep,
      note: 'True platform cash on Stripe after earmarking driver payouts and tax remittance. Mercury balance is separate — once Stripe payouts land at Mercury, the same obligations get paid out from there.',
    },
  })
}
