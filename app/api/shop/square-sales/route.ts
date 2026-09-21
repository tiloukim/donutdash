import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerShop as getActiveShop } from '@/lib/shop-auth'
import { fetchSquareSales, squareSalesConfigured } from '@/lib/square-sales'

// GET /api/shop/square-sales?from=YYYY-MM-DD&to=YYYY-MM-DD&tz_offset=n
//
// The Square Register's side of the counter. Mirrors /api/shop/walkin-sales —
// same auth, same day-boundary handling, same response shape — so the two
// feeds can be shown together and their totals added without either one
// having to know how the other works.

export const dynamic = 'force-dynamic'

const MAX_LIMIT = 500
const DEFAULT_LIMIT = 200

// Identical to the walk-in route's, and for the same reason: 'YYYY-MM-DD' is a
// local day, and parsing it as UTC would start Tyler's day at 6pm the night
// before and file a morning's sales against yesterday.
function dayRange(from: string, to: string, offsetMinutes: number) {
  const mk = (d: string, endOfDay: boolean) => {
    const [y, m, day] = d.split('-').map(Number)
    if (!y || !m || !day) return null
    const localMs = Date.UTC(y, m - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0)
    return new Date(localMs + offsetMinutes * 60_000)
  }
  const start = mk(from, false)
  const end = mk(to, true)
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  return { start: start.toISOString(), end: end.toISOString() }
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const shop = await getActiveShop(svc, ddUser.id)
  if (!shop) return NextResponse.json({ error: 'No shop' }, { status: 404 })

  if (!squareSalesConfigured()) {
    return NextResponse.json({ configured: false, sales: [], totals: null })
  }

  const { searchParams } = new URL(req.url)
  const today = new Date().toISOString().slice(0, 10)
  const from = searchParams.get('from') || today
  const to = searchParams.get('to') || from
  const offsetMinutes = Number(searchParams.get('tz_offset') ?? 0) || 0
  const limit = Math.min(Number(searchParams.get('limit')) || DEFAULT_LIMIT, MAX_LIMIT)

  const range = dayRange(from, to, offsetMinutes)
  if (!range) return NextResponse.json({ error: 'from/to must be YYYY-MM-DD' }, { status: 400 })

  try {
    const result = await fetchSquareSales(range.start, range.end, limit)
    return NextResponse.json({ configured: true, ...result })
  } catch (error) {
    console.error('[square-sales] failed', error)
    // A Square outage must not take the DonutDash feed down with it, so this
    // answers with an error the page can show beside sales it already has.
    return NextResponse.json(
      { configured: true, error: 'Could not reach Square.', sales: [], totals: null },
      { status: 502 },
    )
  }
}
