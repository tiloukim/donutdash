import { NextRequest, NextResponse } from 'next/server'
import { authorizeForShop } from '@/lib/pos-shop-auth'

// GET /api/pos/builds?shop_id=uuid[&limit=n]
//
// Release history for the POS app: what shipped, when, and what changed.
//
// /api/pos/latest-build answers "is there something newer" and returns one
// row. This answers "what am I running and what came before it", which is
// the question someone asks when a register behaves differently from the
// one beside it.
//
// Authenticated on the same footing as latest-build — the rows carry APK
// URLs, and an unauthenticated endpoint would hand out our build artifacts
// to anyone who guessed the path.

export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

export async function GET(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get('shop_id')
  if (!shopId) return NextResponse.json({ error: 'shop_id is required' }, { status: 400 })

  const a = await authorizeForShop(shopId, { privilegedRoles: ['admin'] })
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || DEFAULT_LIMIT, MAX_LIMIT)

  const { data, error } = await a.svc
    .from('dd_app_releases')
    // Released rows only. A build that was recorded and never released is an
    // internal state — showing it to a shop invites "why can't I install 45".
    .select('build_number, version, notes, released_at')
    .eq('is_released', true)
    .order('build_number', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    builds: (data ?? []).map((b) => ({
      buildNumber: b.build_number,
      version: b.version,
      notes: b.notes ?? null,
      releasedAt: b.released_at,
    })),
  })
}
