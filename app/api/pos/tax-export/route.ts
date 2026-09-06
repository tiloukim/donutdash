import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { timingSafeEqual } from 'crypto'

// GET /api/pos/tax-export?shop_id=<uuid>&year=<yyyy>
//
// Read-only accounting extract for one shop's completed orders, so the tax
// workspace can pull sales into that shop's own books.
//
// This endpoint exists so the service-role key never has to leave this project.
// It returns only the money fields an income statement needs — no customer
// names, phones, emails, addresses, card details or staff ids — and only for
// the single shop asked for.

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

  if (!/^[0-9a-f-]{36}$/i.test(shopId)) {
    return NextResponse.json({ error: 'Bad shop id.' }, { status: 400 })
  }
  if (!/^\d{4}$/.test(year)) {
    return NextResponse.json({ error: 'Bad year.' }, { status: 400 })
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
