import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { SHOP_COMMISSION_RATE } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || ddUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const year = parseInt(req.nextUrl.searchParams.get('year') || String(new Date().getFullYear()))
  const type = req.nextUrl.searchParams.get('type') || '1099' // 1099, quarterly, annual, driver_payments, shop_payments
  const yearStart = `${year}-01-01T00:00:00.000Z`
  const yearEnd = `${year + 1}-01-01T00:00:00.000Z`

  // Fetch all data
  const [driversRes, deliveriesRes, ordersRes, payoutsRes, docsRes, shopsRes, shopOwnersRes] = await Promise.all([
    svc.from('dd_users').select('id, name, email, phone, bank_account_holder, bank_routing_number, bank_account_number, created_at').eq('role', 'driver'),
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
      .select('id, user_id, amount, status, paid_at, payment_method, payment_info, created_at')
      .gte('created_at', yearStart)
      .lt('created_at', yearEnd),
    svc.from('dd_driver_documents')
      .select('driver_id, doc_type, status')
      .eq('doc_type', 'w9'),
    svc.from('dd_shops').select('id, name, owner_id'),
    svc.from('dd_users').select('id, name, email, phone, bank_account_holder, bank_routing_number, bank_account_number').eq('role', 'shop_owner'),
  ])

  const drivers = driversRes.data || []
  const deliveries = deliveriesRes.data || []
  const orders = ordersRes.data || []
  const payouts = payoutsRes.data || []
  const w9Docs = docsRes.data || []
  const shops = shopsRes.data || []
  const shopOwners = shopOwnersRes.data || []

  const calcDriverEarnings = (driverId: string) => {
    return deliveries.filter(d => d.driver_id === driverId).reduce((sum, d) => {
      const basePay = d.base_pay || 2.50
      const tip = (d.order as any)?.tip || 0
      const distanceMiles = d.distance_miles || 2
      const stored = d.driver_earnings || 4.00
      const calc = basePay + (distanceMiles * 0.55) + tip
      return sum + Math.max(stored, Math.round(calc * 100) / 100)
    }, 0)
  }

  // === 1099-NEC Summary ===
  if (type === '1099') {
    const rows = [['Driver Name', 'Email', 'Phone', 'Total Earnings', '1099 Required', 'W-9 Status', 'Deliveries', 'Total Paid', 'Unpaid']]
    for (const driver of drivers) {
      const earnings = calcDriverEarnings(driver.id)
      if (earnings === 0) continue
      const paid = payouts.filter(p => p.user_id === driver.id && p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0)
      const w9 = w9Docs.find(d => d.driver_id === driver.id)
      const deliveryCount = deliveries.filter(d => d.driver_id === driver.id).length
      rows.push([
        driver.name, driver.email, driver.phone || '', earnings.toFixed(2),
        earnings >= 600 ? 'YES' : 'NO', w9 ? w9.status : 'MISSING',
        String(deliveryCount), paid.toFixed(2), (earnings - paid).toFixed(2),
      ])
    }
    return csvResponse(rows, `donutdash-1099-summary-${year}.csv`)
  }

  // === Quarterly Tax Summary ===
  if (type === 'quarterly') {
    const rows = [['Quarter', 'Total Revenue', 'Shop Commissions', 'Service Fees', 'Delivery Fees', 'Driver Payouts', 'Tips (Pass-through)', 'Net Taxable Income', 'Orders']]
    let totalRev = 0, totalComm = 0, totalSF = 0, totalDF = 0, totalDP = 0, totalTips = 0, totalNet = 0, totalOrders = 0

    for (let q = 0; q < 4; q++) {
      const qStart = new Date(year, q * 3, 1)
      const qEnd = new Date(year, (q + 1) * 3, 1)
      const qOrders = orders.filter(o => { const d = new Date(o.created_at); return d >= qStart && d < qEnd })
      const qDeliveries = deliveries.filter(d => { const dt = new Date(d.delivered_at); return dt >= qStart && dt < qEnd })

      const rev = qOrders.reduce((s, o) => s + Number(o.total || 0), 0)
      const subtotal = qOrders.reduce((s, o) => s + Number(o.subtotal || 0), 0)
      const comm = subtotal * SHOP_COMMISSION_RATE
      const sf = qOrders.reduce((s, o) => s + Number(o.service_fee || 0), 0)
      const df = qOrders.reduce((s, o) => s + Number(o.delivery_fee || 0), 0)
      const tips = qOrders.reduce((s, o) => s + Number(o.tip || 0), 0)
      const dp = qDeliveries.reduce((s, d) => {
        const bp = d.base_pay || 2.50; const t = (d.order as any)?.tip || 0; const dm = d.distance_miles || 2
        return s + Math.max(d.driver_earnings || 4, Math.round((bp + dm * 0.55 + t) * 100) / 100)
      }, 0)
      const net = comm + sf + df - dp

      totalRev += rev; totalComm += comm; totalSF += sf; totalDF += df; totalDP += dp; totalTips += tips; totalNet += net; totalOrders += qOrders.length
      rows.push([`Q${q + 1} ${year}`, rev.toFixed(2), comm.toFixed(2), sf.toFixed(2), df.toFixed(2), dp.toFixed(2), tips.toFixed(2), net.toFixed(2), String(qOrders.length)])
    }
    rows.push(['TOTAL', totalRev.toFixed(2), totalComm.toFixed(2), totalSF.toFixed(2), totalDF.toFixed(2), totalDP.toFixed(2), totalTips.toFixed(2), totalNet.toFixed(2), String(totalOrders)])
    rows.push([])
    rows.push(['Estimated Self-Employment Tax (15.3%)', (totalNet * 0.153).toFixed(2)])
    rows.push(['Estimated Federal Income Tax (~22%)', (totalNet * 0.22).toFixed(2)])
    rows.push(['Total Estimated Tax', (totalNet * 0.153 + totalNet * 0.22).toFixed(2)])

    return csvResponse(rows, `donutdash-quarterly-tax-${year}.csv`)
  }

  // === Annual P&L Statement ===
  if (type === 'annual') {
    const totalRevenue = orders.reduce((s, o) => s + Number(o.total || 0), 0)
    const totalSubtotal = orders.reduce((s, o) => s + Number(o.subtotal || 0), 0)
    const totalServiceFees = orders.reduce((s, o) => s + Number(o.service_fee || 0), 0)
    const totalDeliveryFees = orders.reduce((s, o) => s + Number(o.delivery_fee || 0), 0)
    const totalTips = orders.reduce((s, o) => s + Number(o.tip || 0), 0)
    const shopCommissions = totalSubtotal * SHOP_COMMISSION_RATE
    const shopPayouts = totalSubtotal - shopCommissions
    const driverPayouts = deliveries.reduce((s, d) => {
      const bp = d.base_pay || 2.50; const t = (d.order as any)?.tip || 0; const dm = d.distance_miles || 2
      return s + Math.max(d.driver_earnings || 4, Math.round((bp + dm * 0.55 + t) * 100) / 100)
    }, 0)

    const rows = [
      ['DonutDash Annual Profit & Loss Statement'],
      [`Tax Year ${year}`],
      [`Generated: ${new Date().toLocaleDateString()}`],
      [],
      ['REVENUE'],
      ['Total Customer Payments (Gross Revenue)', totalRevenue.toFixed(2)],
      ['  Food Subtotals', totalSubtotal.toFixed(2)],
      ['  Service Fees Collected', totalServiceFees.toFixed(2)],
      ['  Delivery Fees Collected', totalDeliveryFees.toFixed(2)],
      ['  Tips Collected (Pass-through)', totalTips.toFixed(2)],
      [],
      ['PLATFORM INCOME'],
      ['Shop Commissions Earned (15%)', shopCommissions.toFixed(2)],
      ['Service Fees Earned', totalServiceFees.toFixed(2)],
      ['Delivery Fees Earned', totalDeliveryFees.toFixed(2)],
      ['Total Platform Income', (shopCommissions + totalServiceFees + totalDeliveryFees).toFixed(2)],
      [],
      ['EXPENSES'],
      ['Driver Payouts', driverPayouts.toFixed(2)],
      ['Shop Payouts (85% of subtotals)', shopPayouts.toFixed(2)],
      ['Tips Passed to Drivers', totalTips.toFixed(2)],
      [],
      ['NET TAXABLE INCOME', (shopCommissions + totalServiceFees + totalDeliveryFees - driverPayouts).toFixed(2)],
      [],
      ['TAX ESTIMATES'],
      ['Self-Employment Tax (15.3%)', ((shopCommissions + totalServiceFees + totalDeliveryFees - driverPayouts) * 0.153).toFixed(2)],
      ['Federal Income Tax (~22%)', ((shopCommissions + totalServiceFees + totalDeliveryFees - driverPayouts) * 0.22).toFixed(2)],
      [],
      ['OPERATIONAL STATS'],
      ['Total Orders', String(orders.length)],
      ['Total Deliveries', String(deliveries.length)],
      ['Active Drivers', String(drivers.filter(d => deliveries.some(del => del.driver_id === d.id)).length)],
      ['Active Shops', String(new Set(orders.map(o => o.shop_id)).size)],
    ]
    return csvResponse(rows, `donutdash-annual-pnl-${year}.csv`)
  }

  // === Driver Payment History ===
  if (type === 'driver_payments') {
    const rows = [['Date', 'Driver', 'Email', 'Amount', 'Status', 'Payment Method', 'Payment Info']]
    const allPayouts = payouts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    for (const p of allPayouts) {
      const driver = drivers.find(d => d.id === p.user_id) || shopOwners.find(d => d.id === p.user_id)
      rows.push([
        new Date(p.created_at).toLocaleDateString(),
        driver?.name || 'Unknown',
        driver?.email || '',
        Number(p.amount).toFixed(2),
        p.status,
        p.payment_method || '',
        p.payment_info || '',
      ])
    }
    return csvResponse(rows, `donutdash-driver-payments-${year}.csv`)
  }

  // === Shop Payment Summary ===
  if (type === 'shop_payments') {
    const rows = [['Shop Name', 'Owner', 'Email', 'Total Sales', 'Commission (15%)', 'Owed to Shop', 'Orders', 'Bank Holder', 'Routing (last 4)', 'Account (last 4)']]
    const shopMap = new Map<string, { subtotal: number; orders: number }>()
    for (const order of orders) {
      const existing = shopMap.get(order.shop_id) || { subtotal: 0, orders: 0 }
      existing.subtotal += Number(order.subtotal || 0)
      existing.orders += 1
      shopMap.set(order.shop_id, existing)
    }
    for (const [shopId, data] of shopMap.entries()) {
      const shop = shops.find(s => s.id === shopId)
      const owner = shopOwners.find(o => o.id === shop?.owner_id)
      const comm = data.subtotal * SHOP_COMMISSION_RATE
      rows.push([
        shop?.name || 'Unknown',
        owner?.name || '',
        owner?.email || '',
        data.subtotal.toFixed(2),
        comm.toFixed(2),
        (data.subtotal - comm).toFixed(2),
        String(data.orders),
        owner?.bank_account_holder || '',
        owner?.bank_routing_number ? '****' + owner.bank_routing_number.slice(-4) : '',
        owner?.bank_account_number ? '****' + owner.bank_account_number.slice(-4) : '',
      ])
    }
    return csvResponse(rows, `donutdash-shop-payments-${year}.csv`)
  }

  // === Monthly Breakdown ===
  if (type === 'monthly') {
    const rows = [['Month', 'Revenue', 'Shop Commissions', 'Service Fees', 'Delivery Fees', 'Driver Pay', 'Tips', 'Net Income', 'Orders']]
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    for (let m = 0; m < 12; m++) {
      const mStart = new Date(year, m, 1)
      const mEnd = new Date(year, m + 1, 1)
      const mOrders = orders.filter(o => { const d = new Date(o.created_at); return d >= mStart && d < mEnd })
      const mDeliveries = deliveries.filter(d => { const dt = new Date(d.delivered_at); return dt >= mStart && dt < mEnd })

      const rev = mOrders.reduce((s, o) => s + Number(o.total || 0), 0)
      const sub = mOrders.reduce((s, o) => s + Number(o.subtotal || 0), 0)
      const comm = sub * SHOP_COMMISSION_RATE
      const sf = mOrders.reduce((s, o) => s + Number(o.service_fee || 0), 0)
      const df = mOrders.reduce((s, o) => s + Number(o.delivery_fee || 0), 0)
      const tips = mOrders.reduce((s, o) => s + Number(o.tip || 0), 0)
      const dp = mDeliveries.reduce((s, d) => {
        const bp = d.base_pay || 2.50; const t = (d.order as any)?.tip || 0; const dm = d.distance_miles || 2
        return s + Math.max(d.driver_earnings || 4, Math.round((bp + dm * 0.55 + t) * 100) / 100)
      }, 0)

      rows.push([`${months[m]} ${year}`, rev.toFixed(2), comm.toFixed(2), sf.toFixed(2), df.toFixed(2), dp.toFixed(2), tips.toFixed(2), (comm + sf + df - dp).toFixed(2), String(mOrders.length)])
    }
    return csvResponse(rows, `donutdash-monthly-breakdown-${year}.csv`)
  }

  return NextResponse.json({ error: 'Invalid export type' }, { status: 400 })
}

function csvResponse(rows: string[][], filename: string) {
  const csv = rows.map(row => row.map(cell => {
    if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
      return `"${cell.replace(/"/g, '""')}"`
    }
    return cell
  }).join(',')).join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
