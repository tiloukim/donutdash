import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { timingSafeEqual } from 'crypto'

// GET /api/pos/tax-export?shop_id=<uuid>&year=<yyyy>
// GET /api/pos/tax-export?scope=platform&year=<yyyy>
//
// Read-only accounting extract so the tax workspace can pull figures into the
// right set of books. Two scopes, because two different businesses earn from
// the same order:
//
//   shop      — what the shop sold. Sales for that shop's own books.
//   platform  — what DonutDash Technologies earned for carrying the order:
//               delivery, service and small-order fees plus commission, and
//               against them what the drivers were paid.
//
// This endpoint exists so the service-role key never has to leave this project.
// It returns only the money fields an income statement needs — no customer
// names, phones, emails, addresses, card details or staff ids. The platform
// scope additionally returns driver id and name, because paying a driver is a
// deductible cost that has to be attributed to a person (and may need a 1099),
// while paying yourself is a draw and is not deductible at all.

const FIELDS = [
  'id',
  'created_at',
  'status',
  'subtotal',
  'tax',
  'tip',
  'delivery_fee',
  'service_fee',
  'small_order_fee',
  'discount_amount',
  'promo_discount',
  'cash_discount_amount',
  'refund_amount',
  'total',
  'payment_method',
  'order_type',
].join(',')

function authorized(request: NextRequest): boolean {
  const expected = process.env.TAX_EXPORT_TOKEN
  if (!expected) return false
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return false
  const a = Buffer.from(token)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

// What the platform earns from an order, and what it pays out on it.
const PLATFORM_FIELDS = [
  'id',
  'created_at',
  'status',
  'shop_id',
  'subtotal',
  'tip',
  'delivery_fee',
  'service_fee',
  'small_order_fee',
  'commission_pct',
  'payment_method',
  'order_type',
].join(',')

const DELIVERY_FIELDS = [
  'order_id',
  'status',
  'driver_id',
  'driver_name',
  'driver_earnings',
  'base_pay',
  'bonus',
  'distance_miles',
].join(',')

/**
 * Platform-side figures for a year, across every shop.
 *
 * Deliveries come back alongside the orders rather than pre-netted, because
 * the two sides are taxed differently: fees are income to the platform, driver
 * pay is a deductible cost only when the driver is someone other than the
 * owner, and the tip inside a payout is the customer's money passing through
 * and is neither. Netting here would destroy the distinction.
 */
async function platformExtract(year: string) {
  const svc = createServiceClient()
  const from = `${year}-01-01`
  const to = `${Number(year) + 1}-01-01`

  const { data: orders, error } = await svc
    .from('dd_orders')
    .select(PLATFORM_FIELDS)
    .gte('created_at', from)
    .lt('created_at', to)
    .order('created_at', { ascending: true })
    .limit(5000)

  if (error) {
    console.error('[tax-export] platform orders failed', error.message)
    return NextResponse.json({ error: 'Could not read orders.' }, { status: 502 })
  }

  const { data: deliveries, error: deliveryError } = await svc
    .from('dd_deliveries')
    .select(DELIVERY_FIELDS)
    .gte('created_at', from)
    .lt('created_at', to)
    .limit(5000)

  if (deliveryError) {
    console.error('[tax-export] platform deliveries failed', deliveryError.message)
    return NextResponse.json({ error: 'Could not read deliveries.' }, { status: 502 })
  }

  return NextResponse.json(
    { scope: 'platform', year, orders: orders ?? [], deliveries: deliveries ?? [] },
    { headers: { 'cache-control': 'no-store' } },
  )
}

export async function GET(request: NextRequest) {
  if (!process.env.TAX_EXPORT_TOKEN) {
    return NextResponse.json({ error: 'Export is not configured.' }, { status: 503 })
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const shopId = searchParams.get('shop_id') ?? ''
  const year = searchParams.get('year') ?? ''
  const scope = searchParams.get('scope') ?? 'shop'

  if (!/^\d{4}$/.test(year)) {
    return NextResponse.json({ error: 'Bad year.' }, { status: 400 })
  }
  if (scope === 'platform') {
    return platformExtract(year)
  }
  if (!/^[0-9a-f-]{36}$/i.test(shopId)) {
    return NextResponse.json({ error: 'Bad shop id.' }, { status: 400 })
  }

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('dd_orders')
    .select(FIELDS)
    .eq('shop_id', shopId)
    .gte('created_at', `${year}-01-01`)
    .lt('created_at', `${Number(year) + 1}-01-01`)
    .order('created_at', { ascending: true })
    .limit(5000)

  if (error) {
    console.error('[tax-export] query failed', error.message)
    return NextResponse.json({ error: 'Could not read orders.' }, { status: 502 })
  }

  return NextResponse.json(
    { shopId, year, orders: data ?? [] },
    { headers: { 'cache-control': 'no-store' } },
  )
}

// Shops the owner can map a tax entity to. Name and city only.
export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 401 })
  }
  const svc = createServiceClient()
  const { data, error } = await svc
    .from('dd_shops')
    .select('id,name,city')
    .order('name', { ascending: true })
    .limit(500)

  if (error) {
    return NextResponse.json({ error: 'Could not list shops.' }, { status: 502 })
  }
  return NextResponse.json({ shops: data ?? [] }, { headers: { 'cache-control': 'no-store' } })
}
