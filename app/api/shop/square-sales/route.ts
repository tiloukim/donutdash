import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerShop } from '@/lib/shop-auth'
import { decryptToken, fetchShopSquareSales } from '@/lib/shop-square'

// GET /api/shop/square-sales?from=YYYY-MM-DD&to=YYYY-MM-DD&tz_offset=n
//
// This shop's Square register for a day.
//
// A route of this name existed before and was removed, because it read the
// platform's own Square account and showed the same payments to every shop
// — donutdash.app's online orders, under a heading claiming they were that
// shop's register. Fisherman's Donut showed zeros and a footnote about an
// online order it had nothing to do with.
//
// The difference now is the credentials: each shop's own token, stored
// against its own row, so the answer is the shop's or there is no answer.
// There is no platform fallback, deliberately — a fallback here would
// resurrect exactly the bug that got the old route deleted.

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/** Local day → UTC instants, using the browser's offset. 'YYYY-MM-DD' is a
 *  local day; parsing it as UTC would start Tyler's day at 6pm the night
 *  before and file a morning's takings against yesterday. */
function dayRange(from: string, to: string, offsetMinutes: number) {
  const mk = (d: string, endOfDay: boolean) => {
    const [y, m, day] = d.split('-').map(Number)
    if (!y || !m || !day) return null
    const ms = Date.UTC(y, m - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0)
    return new Date(ms + offsetMinutes * 60_000)
  }
  const start = mk(from, false)
  const end = mk(to, true)
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  return { start: start.toISOString(), end: end.toISOString() }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: me } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!me || (me.role !== 'shop_owner' && me.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const shop = await resolveOwnerShop(svc, me.id)
  if (!shop) return NextResponse.json({ error: 'No shop' }, { status: 404 })

  const { data } = await svc
    .from('dd_shops')
    .select('square_access_token, square_location_id')
    .eq('id', shop.id)
    .maybeSingle()
  const row = data as { square_access_token?: string | null; square_location_id?: string | null } | null

  if (!row?.square_access_token || !row.square_location_id) {
    // Not an error. Most shops will never connect a Square, and the page
    // should say "not connected" rather than show a failure.
    return NextResponse.json({ connected: false, sales: [], totals: null })
  }

  const { searchParams } = new URL(req.url)
  const today = new Date().toISOString().slice(0, 10)
  const from = searchParams.get('from') || today
  const to = searchParams.get('to') || from
  const offsetMinutes = Number(searchParams.get('tz_offset') ?? 0) || 0
  const range = dayRange(from, to, offsetMinutes)
  if (!range) return NextResponse.json({ error: 'Bad date.' }, { status: 400 })

  try {
    const token = decryptToken(row.square_access_token)
    const result = await fetchShopSquareSales(token, row.square_location_id, range.start, range.end)
    return NextResponse.json({ connected: true, ...result })
  } catch (e) {
    console.error('[shop/square-sales]', e)
    return NextResponse.json(
      { connected: true, sales: [], totals: null, error: e instanceof Error ? e.message : 'Could not read Square.' },
      { status: 200 },
    )
  }
}
