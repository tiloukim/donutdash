import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveCommissionRate } from '@/lib/constants'
import { resolveOwnerShop as getActiveShop } from '@/lib/shop-auth'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, name, email, role').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const shop = await getActiveShop(svc, ddUser.id)
  if (!shop) return NextResponse.json({ error: 'No shop found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())

  // Get all completed orders for this shop in the given year
  const { data: orders } = await svc.from('dd_orders')
    .select('id, total, subtotal, status, created_at, commission_pct')
    .eq('shop_id', shop.id)
    .eq('status', 'delivered')
    .gte('created_at', `${year}-01-01`)
    .lte('created_at', `${year}-12-31T23:59:59`)

  const allOrders = orders || []

  // Monthly breakdown
  const monthly: number[] = Array(12).fill(0)
  let grossAmount = 0
  let platformFees = 0
  let transactionCount = 0

  for (const o of allOrders) {
    const m = new Date(o.created_at).getMonth()
    monthly[m] += o.total
    grossAmount += o.total
    platformFees += Number(o.subtotal || 0) * resolveCommissionRate(o)
    transactionCount++
  }

  return NextResponse.json({
    year,
    shop: { name: shop.name, address: shop.address, city: shop.city, state: shop.state, zip: shop.zip, phone: shop.phone, tax_id: shop.tax_id },
    owner: { name: ddUser.name, email: ddUser.email },
    grossAmount,
    platformFees,
    netAmount: grossAmount - platformFees,
    transactionCount,
    monthly,
    // 1099-K threshold: IRS requires filing if gross > $600 (as of 2024+)
    meetsThreshold: grossAmount >= 600,
  })
}
