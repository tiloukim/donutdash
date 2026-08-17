import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { BASE_DELIVERY_PAY, PER_MILE_PAY, resolveCommissionRate } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || ddUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const year = parseInt(req.nextUrl.searchParams.get('year') || String(new Date().getFullYear()))
  const yearStart = `${year}-01-01T00:00:00.000Z`
  const yearEnd = `${year + 1}-01-01T00:00:00.000Z`

  // Fetch all data in parallel
  const [driversRes, deliveriesRes, ordersRes, payoutsRes, docsRes, shopsRes, shopDocsRes, salesTaxRes] = await Promise.all([
    svc.from('dd_users').select('id, name, email, phone, created_at, w9_legal_name, w9_address, w9_city, w9_state, w9_zip, w9_tax_id_type, w9_tax_id, w9_submitted_at').eq('role', 'driver'),
    svc.from('dd_deliveries')
      .select('id, driver_id, driver_earnings, base_pay, distance_miles, status, delivered_at, order:dd_orders(tip)')
      .eq('status', 'delivered')
      .gte('delivered_at', yearStart)
      .lt('delivered_at', yearEnd),
    svc.from('dd_orders')
      .select('id, total, subtotal, delivery_fee, service_fee, tip, refund_amount, status, created_at, shop_id, commission_pct')
      .neq('status', 'cancelled')
      .in('order_type', ['delivery', 'pickup'])
      .gte('created_at', yearStart)
      .lt('created_at', yearEnd),
    svc.from('dd_payout_requests')
      .select('id, user_id, amount, status, paid_at')
      .eq('status', 'paid')
      .gte('paid_at', yearStart)
      .lt('paid_at', yearEnd),
    svc.from('dd_driver_documents')
      .select('driver_id, doc_type, status')
      .eq('doc_type', 'w9'),
    svc.from('dd_shops')
      .select('id, name, owner_id, owner:dd_users!owner_id(name, email, phone)'),
    svc.from('dd_shop_documents')
      .select('shop_id, doc_type, status')
      .eq('doc_type', 'w9'),
    // All-time delivery-service sales tax (for the "set aside to remit" card).
    svc.from('dd_orders')
      .select('tax, refund_amount, created_at')
      .neq('status', 'cancelled')
      .in('order_type', ['delivery', 'pickup']),
  ])

  const drivers = driversRes.data || []
  const deliveries = deliveriesRes.data || []
  const orders = ordersRes.data || []
  const payouts = payoutsRes.data || []
  const w9Docs = docsRes.data || []
  const shops = shopsRes.data || []
  const shopW9Docs = shopDocsRes.data || []

  // Sales tax collected on delivery-service orders — the amount to set aside and
  // remit to the state. Excludes refunded orders (the tax was refunded too).
  const nowD = new Date()
  const monthStartIso = new Date(nowD.getFullYear(), nowD.getMonth(), 1).toISOString()
  // Current week, starting Sunday (the natural "weekly batch" window).
  const weekStart = new Date(nowD); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(nowD.getDate() - nowD.getDay())
  const weekStartIso = weekStart.toISOString()
  const taxRows = (salesTaxRes.data || []) as Array<{ tax: number | null; refund_amount: number | null; created_at: string }>
  const taxSum = (rows: typeof taxRows) =>
    Math.round(rows.reduce((s, o) => s + (Number(o.refund_amount) > 0 ? 0 : (Number(o.tax) || 0)), 0) * 100) / 100
  const salesTaxToRemit = {
    thisWeek: taxSum(taxRows.filter(o => o.created_at >= weekStartIso)),
    thisMonth: taxSum(taxRows.filter(o => o.created_at >= monthStartIso)),
    thisYear: taxSum(taxRows.filter(o => o.created_at >= yearStart && o.created_at < yearEnd)),
    allTime: taxSum(taxRows),
  }

  // Per-week ledger — one row per weekly batch (Sunday-start, Central time) with
  // the tax collected to set aside. Refunded orders owe no tax and are skipped.
  const weekMap = new Map<string, { tax: number; orders: number }>()
  for (const o of taxRows) {
    if (Number(o.refund_amount) > 0) continue
    const ymd = new Date(o.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }) // YYYY-MM-DD Central
    const wd = new Date(`${ymd}T12:00:00Z`); wd.setUTCDate(wd.getUTCDate() - wd.getUTCDay()) // back to Sunday
    const wk = wd.toISOString().slice(0, 10)
    const cur = weekMap.get(wk) || { tax: 0, orders: 0 }
    cur.tax += Number(o.tax) || 0
    cur.orders += 1
    weekMap.set(wk, cur)
  }
  const salesTaxByWeek = [...weekMap.entries()]
    .map(([weekStart, v]) => ({ weekStart, tax: Math.round(v.tax * 100) / 100, orders: v.orders }))
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
    .slice(0, 26)

  // Per-driver earnings breakdown
  const driverSummaries = drivers.map(driver => {
    const driverDeliveries = deliveries.filter(d => d.driver_id === driver.id)
    const totalEarnings = driverDeliveries.reduce((sum, d) => {
      const stored = Number(d.driver_earnings) || 0
      if (stored > 0) return sum + stored
      const basePay = Number(d.base_pay) || BASE_DELIVERY_PAY
      const tip = Number((d.order as any)?.tip) || 0
      const distanceMiles = Number(d.distance_miles) || 0
      return sum + Math.round((basePay + distanceMiles * PER_MILE_PAY + tip) * 100) / 100
    }, 0)

    const totalPaid = payouts
      .filter(p => p.user_id === driver.id)
      .reduce((sum, p) => sum + Number(p.amount), 0)

    const w9 = w9Docs.find(d => d.driver_id === driver.id)

    return {
      id: driver.id,
      name: driver.name,
      email: driver.email,
      phone: driver.phone,
      deliveryCount: driverDeliveries.length,
      totalEarnings: Math.round(totalEarnings * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      unpaid: Math.round((totalEarnings - totalPaid) * 100) / 100,
      needs1099: totalEarnings >= 600,
      w9Status: w9 ? w9.status : 'missing',
      w9Data: (driver as any).w9_tax_id ? {
        legalName: (driver as any).w9_legal_name,
        address: (driver as any).w9_address,
        city: (driver as any).w9_city,
        state: (driver as any).w9_state,
        zip: (driver as any).w9_zip,
        taxIdType: (driver as any).w9_tax_id_type,
        taxId: (driver as any).w9_tax_id, // full SSN/EIN for 1099 filing
        submittedAt: (driver as any).w9_submitted_at,
      } : null,
    }
  }).filter(d => d.deliveryCount > 0 || d.totalPaid > 0)
    .sort((a, b) => b.totalEarnings - a.totalEarnings)

  // Effective amounts after partial refunds — applied proportionally
  // across all line items (matches /api/shop/earnings + /api/admin/payouts).
  const effSubtotal = (o: typeof orders[number]) => {
    const s = Number(o.subtotal || 0); const t = Number(o.total || 0); const r = Number(o.refund_amount || 0)
    if (r <= 0 || t <= 0) return s
    return Math.max(0, s * (1 - Math.min(r / t, 1)))
  }
  const effShare = (raw: number, o: typeof orders[number]) => {
    const t = Number(o.total || 0); const r = Number(o.refund_amount || 0)
    if (r <= 0 || t <= 0) return raw
    return Math.max(0, raw * (1 - Math.min(r / t, 1)))
  }

  // Platform income summary. Subtract refund_amount everywhere — without
  // this, refunded orders inflate 1099 totals (the IRS gets a number the
  // shop / driver never actually received).
  const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total || 0) - Number(o.refund_amount || 0)), 0)
  const totalDeliveryFees = orders.reduce((sum, o) => sum + effShare(Number(o.delivery_fee || 0), o), 0)
  const totalServiceFees = orders.reduce((sum, o) => sum + effShare(Number(o.service_fee || 0), o), 0)
  const totalTips = orders.reduce((sum, o) => sum + effShare(Number(o.tip || 0), o), 0)
  const shopCommissions = Math.round(orders.reduce((sum, o) => sum + effSubtotal(o) * resolveCommissionRate(o), 0) * 100) / 100
  const totalDriverEarnings = driverSummaries.reduce((sum, d) => sum + d.totalEarnings, 0)

  // Platform taxable income = commissions + service fees + delivery fees - driver payouts
  const platformIncome = Math.round((shopCommissions + totalServiceFees + totalDeliveryFees - totalDriverEarnings) * 100) / 100

  // Quarterly breakdown
  const quarters = [0, 1, 2, 3].map(q => {
    const qStart = new Date(year, q * 3, 1)
    const qEnd = new Date(year, (q + 1) * 3, 1)
    const qOrders = orders.filter(o => {
      const d = new Date(o.created_at)
      return d >= qStart && d < qEnd
    })
    const qRevenue = qOrders.reduce((sum, o) => sum + (Number(o.total || 0) - Number(o.refund_amount || 0)), 0)
    const qServiceFees = qOrders.reduce((sum, o) => sum + effShare(Number(o.service_fee || 0), o), 0)
    const qDeliveryFees = qOrders.reduce((sum, o) => sum + effShare(Number(o.delivery_fee || 0), o), 0)
    const qCommissions = Math.round(qOrders.reduce((sum, o) => sum + effSubtotal(o) * resolveCommissionRate(o), 0) * 100) / 100

    const qDeliveries = deliveries.filter(d => {
      const dt = new Date(d.delivered_at)
      return dt >= qStart && dt < qEnd
    })
    const qDriverPay = qDeliveries.reduce((sum, d) => {
      const stored = Number(d.driver_earnings) || 0
      if (stored > 0) return sum + stored
      const basePay = Number(d.base_pay) || BASE_DELIVERY_PAY
      const tip = Number((d.order as any)?.tip) || 0
      const distanceMiles = Number(d.distance_miles) || 0
      return sum + Math.round((basePay + distanceMiles * PER_MILE_PAY + tip) * 100) / 100
    }, 0)

    return {
      quarter: `Q${q + 1}`,
      revenue: Math.round(qRevenue * 100) / 100,
      commissions: qCommissions,
      serviceFees: Math.round(qServiceFees * 100) / 100,
      deliveryFees: Math.round(qDeliveryFees * 100) / 100,
      driverPay: Math.round(qDriverPay * 100) / 100,
      netIncome: Math.round((qCommissions + qServiceFees + qDeliveryFees - qDriverPay) * 100) / 100,
      orderCount: qOrders.length,
    }
  })

  // Per-shop earnings breakdown (shop gets subtotal minus commission).
  // Same refund-proportional treatment as the platform summary.
  const shopSummaries = shops.map((shop: any) => {
    const shopOrders = orders.filter((o: any) => o.shop_id === shop.id)
    const totalSubtotalShop = shopOrders.reduce((sum: number, o) => sum + effSubtotal(o), 0)
    const commission = Math.round(shopOrders.reduce((sum: number, o) => sum + effSubtotal(o) * resolveCommissionRate(o), 0) * 100) / 100
    const shopEarnings = Math.round((totalSubtotalShop - commission) * 100) / 100
    const owner = shop.owner as any
    const w9 = shopW9Docs.find((d: any) => d.shop_id === shop.id)

    return {
      id: shop.id,
      name: shop.name,
      ownerName: owner?.name || 'Unknown',
      ownerEmail: owner?.email || '',
      ownerPhone: owner?.phone || '',
      orderCount: shopOrders.length,
      totalRevenue: Math.round(totalSubtotalShop * 100) / 100,
      commissionPaid: commission,
      shopEarnings,
      needs1099: shopEarnings >= 600,
      w9Status: w9 ? w9.status : 'missing',
    }
  }).filter((s: any) => s.orderCount > 0)
    .sort((a: any, b: any) => b.shopEarnings - a.shopEarnings)

  return NextResponse.json({
    year,
    salesTaxToRemit,
    salesTaxByWeek,
    platformIncome: {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      shopCommissions,
      serviceFees: Math.round(totalServiceFees * 100) / 100,
      deliveryFees: Math.round(totalDeliveryFees * 100) / 100,
      driverPayouts: Math.round(totalDriverEarnings * 100) / 100,
      tips: Math.round(totalTips * 100) / 100,
      netTaxableIncome: platformIncome,
      estimatedTax: Math.round(platformIncome * 0.153 * 100) / 100, // SE tax 15.3%
      estimatedIncomeTax: Math.round(platformIncome * 0.22 * 100) / 100, // ~22% federal bracket estimate
    },
    quarters,
    drivers: driverSummaries,
    shops: shopSummaries,
    summary: {
      totalDrivers: driverSummaries.length,
      driversNeeding1099: driverSummaries.filter(d => d.needs1099).length,
      driversMissingW9: driverSummaries.filter(d => d.w9Status === 'missing' && d.needs1099).length,
      totalShops: shopSummaries.length,
      shopsNeeding1099: shopSummaries.filter((s: any) => s.needs1099).length,
      shopsMissingW9: shopSummaries.filter((s: any) => s.w9Status === 'missing' && s.needs1099).length,
    },
  })
}
