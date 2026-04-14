import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { SHOP_COMMISSION_RATE } from '@/lib/constants'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, name, email, role').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: shop } = await svc.from('dd_shops').select('id, name, address, city, state, zip, phone').eq('owner_id', ddUser.id).single()
  if (!shop) return NextResponse.json({ error: 'No shop found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())

  // Get all completed orders for this shop in the given year
  const { data: orders } = await svc.from('dd_orders')
    .select('id, total, status, created_at')
    .eq('shop_id', shop.id)
    .eq('status', 'delivered')
    .gte('created_at', `${year}-01-01`)
    .lte('created_at', `${year}-12-31T23:59:59`)

  const allOrders = orders || []

  // Monthly breakdown
  const monthly: number[] = Array(12).fill(0)
  let grossAmount = 0
  let transactionCount = 0

  for (const o of allOrders) {
    const m = new Date(o.created_at).getMonth()
    monthly[m] += o.total
    grossAmount += o.total
    transactionCount++
  }

  // Platform fees (commission)
  const platformFees = grossAmount * SHOP_COMMISSION_RATE

  return NextResponse.json({
    year,
    shop: { name: shop.name, address: shop.address, city: shop.city, state: shop.state, zip: shop.zip, phone: shop.phone },
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
