import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { SHOP_COMMISSION_RATE, BASE_DELIVERY_PAY, PER_MILE_PAY } from '@/lib/constants'

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
  const [driversRes, deliveriesRes, ordersRes, payoutsRes, docsRes, shopsRes, shopDocsRes] = await Promise.all([
    svc.from('dd_users').select('id, name, email, phone, created_at, w9_legal_name, w9_address, w9_city, w9_state, w9_zip, w9_tax_id_type, w9_tax_id, w9_submitted_at').eq('role', 'driver'),
    svc.from('dd_deliveries')
      .select('id, driver_id, driver_earnings, base_pay, distance_miles, status, delivered_at, order:dd_orders(tip)')
      .eq('status', 'delivered')
      .gte('delivered_at', yearStart)
      .lt('delivered_at', yearEnd),
    svc.from('dd_orders')
      .select('id, total, subtotal, delivery_fee, service_fee, tip, status, created_at, shop_id')
      .neq('status', 'cancelled')
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
  ])

  const drivers = driversRes.data || []
  const deliveries = deliveriesRes.data || []
  const orders = ordersRes.data || []
  const payouts = payoutsRes.data || []
  const w9Docs = docsRes.data || []
  const shops = shopsRes.data || []
  const shopW9Docs = shopDocsRes.data || []

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

  // Platform income summary
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0)
  const totalSubtotal = orders.reduce((sum, o) => sum + (o.subtotal || 0), 0)
  const totalDeliveryFees = orders.reduce((sum, o) => sum + (o.delivery_fee || 0), 0)
  const totalServiceFees = orders.reduce((sum, o) => sum + (o.service_fee || 0), 0)
  const totalTips = orders.reduce((sum, o) => sum + (o.tip || 0), 0)
  const shopCommissions = Math.round(totalSubtotal * SHOP_COMMISSION_RATE * 100) / 100
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
    const qRevenue = qOrders.reduce((sum, o) => sum + (o.total || 0), 0)
    const qSubtotal = qOrders.reduce((sum, o) => sum + (o.subtotal || 0), 0)
    const qServiceFees = qOrders.reduce((sum, o) => sum + (o.service_fee || 0), 0)
    const qDeliveryFees = qOrders.reduce((sum, o) => sum + (o.delivery_fee || 0), 0)
    const qCommissions = Math.round(qSubtotal * SHOP_COMMISSION_RATE * 100) / 100

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

  // Per-shop earnings breakdown (shop gets subtotal minus commission)
  const shopSummaries = shops.map((shop: any) => {
    const shopOrders = orders.filter((o: any) => o.shop_id === shop.id)
    const totalSubtotalShop = shopOrders.reduce((sum: number, o: any) => sum + Number(o.subtotal || 0), 0)
    const commission = Math.round(totalSubtotalShop * SHOP_COMMISSION_RATE * 100) / 100
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
