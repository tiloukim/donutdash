import { NextRequest, NextResponse } from 'next/server'
import { authorizeForShop } from '@/lib/pos-shop-auth'

// GET /api/pos/reports/cash?shop_id=&from=&to=
//
// DonutDash Cash for a shop over a window. Server-side because RLS gives a
// shop owner no direct read of dd_cash_ledger — that table is customer money,
// and what an owner may see is a decision for this route, not for a policy
// that would also have to let them see other shops' customers.
//
// Everything is computed by dd_cash_report in one round trip. The route's job
// is to prove who is asking and hand the answer over unchanged.

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get('shop_id')
  if (!shopId) {
    return NextResponse.json({ error: 'shop_id is required' }, { status: 400 })
  }

  const a = await authorizeForShop(shopId)
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')
  if (!from || !to) {
    return NextResponse.json({ error: 'from and to are required' }, { status: 400 })
  }

  const { data, error } = await a.svc.rpc('dd_cash_report', {
    p_shop_id: shopId,
    p_from: from,
    p_to: to,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? {})
}
