import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/shops/:id/menu-tax?ids=a,b,c
//
// The folder is [id], not [shopId]. Next.js refuses two different slug
// names at the same path position, and app/api/shops/[id] already exists —
// naming this one [shopId] did not just break this route, it broke the
// routing table and took /api/pos/staff and /api/shop/orders down with it.
//
// Which of these items the shop has marked exempt from sales tax.
//
// Exists so the checkout page can show the same tax the server will charge.
// The cart lives in localStorage and can be weeks old, so the flag cannot
// ride along on the cart line — by the time it is spent the shop may have
// changed it, and the display would disagree with the charge.
//
// Returns only the EXEMPT ids: the default is taxable, so the exceptions are
// the short list, and a response that loses its way fails toward taxing.
//
// Public, like the menu it describes — this says nothing a customer cannot
// already see by putting the item in a basket. Scoped to one shop and to the
// ids asked for, so it cannot be used to enumerate the catalog.

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: shopId } = await ctx.params
  const raw = req.nextUrl.searchParams.get('ids') ?? ''
  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 200)
  if (!shopId || ids.length === 0) return NextResponse.json({ exempt: [] })

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('dd_menu_items')
    .select('id, taxable')
    .eq('shop_id', shopId)
    .in('id', ids)
    .eq('taxable', false)

  if (error) {
    // Not a failure the customer should see. An empty exempt list is the
    // previous behaviour — everything taxable — and the server recomputes
    // the real figure at checkout regardless.
    console.error('[menu-tax]', error)
    return NextResponse.json({ exempt: [] })
  }
  return NextResponse.json({ exempt: (data ?? []).map((r) => r.id) })
}
