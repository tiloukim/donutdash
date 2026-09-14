import { NextRequest, NextResponse } from 'next/server'
import { authorizeForShop } from '@/lib/pos-shop-auth'

// GET /api/pos/latest-build?shop_id=uuid
//
// What APK, if any, a register should install. Returns the highest
// build_number in dd_app_releases with is_released = true, or null.
//
// Authenticated on purpose. The response carries a direct APK link, and an
// unauthenticated endpoint would hand our build artifacts to anyone who
// guessed the path. authorizeForShop also enforces the admin kill-switch, so
// a deactivated shop stops being offered updates along with everything else.
//
// Recording a build here does NOT offer it to anything — is_released is a
// separate, deliberate step. See supabase/app-releases.sql.

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get('shop_id')
  if (!shopId) {
    return NextResponse.json({ error: 'shop_id is required' }, { status: 400 })
  }

  const a = await authorizeForShop(shopId, { privilegedRoles: ['admin'] })
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  const { data, error } = await a.svc
    .from('dd_app_releases')
    .select('build_number, version, apk_url, notes')
    .eq('is_released', true)
    .order('build_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  // No released build is a normal state, not an error — a fleet with nothing
  // to install should get a quiet "you're current", not a failure the POS has
  // to interpret.
  if (!data) return NextResponse.json(null)

  return NextResponse.json({
    buildNumber: data.build_number,
    version: data.version,
    url: data.apk_url,
    notes: data.notes ?? null,
  })
}
