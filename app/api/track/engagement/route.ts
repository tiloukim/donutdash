import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

// POST /api/track/engagement
//
// Public anonymous endpoint that logs a single shop-page interaction
// for the unclaimed-shop pitch surface. Called from the shop detail
// page via navigator.sendBeacon — so this MUST be fast, low-overhead,
// and tolerant of duplicate / refresh-spam writes (we filter for
// uniqueness at read time, not write time).

// Single-event shape (page_view, lost_order_click, claim_link_click,
// menu_item_view) OR batched-events shape (used for search_impression
// which fires once-per-shop-per-page-render — sending 30+ separate
// HTTPS requests just to log impressions would be wasteful).
interface TrackBody {
  shop_id?: string
  kind?: string
  path?: string
  events?: Array<{ shop_id: string; kind: string; path?: string }>
}

const VALID_KINDS = new Set([
  'page_view',
  'lost_order_click',
  'claim_link_click',
  'menu_item_view',
  'search_impression',
])

// Hash IP + UTC date + a server-side secret to get a per-day per-visitor
// identifier without storing IP. Salt rotates daily via the date so two
// different days produce different hashes for the same IP — no
// cross-day fingerprinting from this data alone. Reuses
// SUPABASE_SERVICE_ROLE_KEY as the secret because we already have it
// and rotating it would invalidate yesterday's hashes anyway (which is
// fine — yesterday's uniqueness count is already locked in).
function hashVisitor(ip: string, utcDateString: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'fallback-salt'
  return createHash('sha256')
    .update(`${ip}::${utcDateString}::${secret}`)
    .digest('hex')
    .slice(0, 32) // 128 bits — plenty of entropy, half the storage
}

function clientIp(req: NextRequest): string {
  // Vercel sets x-forwarded-for; first entry is the originating client.
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

export async function POST(req: NextRequest) {
  let body: TrackBody
  try {
    body = (await req.json()) as TrackBody
  } catch {
    // sendBeacon sometimes posts with content-type=text/plain — try raw.
    try {
      const text = await req.text()
      body = JSON.parse(text) as TrackBody
    } catch {
      return new NextResponse(null, { status: 204 })
    }
  }

  // Normalize: collapse single + batch shapes into one array of events.
  // Bad shapes silently drop — sendBeacon results are invisible to the
  // client so 4xx noise has no point.
  const events: Array<{ shop_id: string; kind: string; path?: string }> = []
  if (Array.isArray(body?.events)) {
    for (const e of body.events) {
      if (e?.shop_id && typeof e.kind === 'string' && VALID_KINDS.has(e.kind)) {
        events.push(e)
      }
    }
  } else if (body?.shop_id && typeof body.kind === 'string' && VALID_KINDS.has(body.kind)) {
    events.push({ shop_id: body.shop_id, kind: body.kind, path: body.path })
  }
  if (events.length === 0) {
    return new NextResponse(null, { status: 204 })
  }

  const svc = createServiceClient()

  // Snapshot each shop's claimed status at write time. Batched in one
  // query so 30+ search_impression events don't hammer the DB.
  const uniqueIds = Array.from(new Set(events.map((e) => e.shop_id)))
  const { data: shopRows } = await svc
    .from('dd_shops')
    .select('id, is_claimed')
    .in('id', uniqueIds)
  const claimedById = new Map<string, boolean>()
  for (const s of (shopRows ?? []) as Array<{ id: string; is_claimed: boolean | null }>) {
    claimedById.set(s.id, s.is_claimed === true)
  }

  const ip = clientIp(req)
  const utcDate = new Date().toISOString().slice(0, 10)
  const visitorHash = hashVisitor(ip, utcDate)
  const referrer = req.headers.get('referer') ?? null
  const userAgent = req.headers.get('user-agent')?.slice(0, 200) ?? null

  const rows = events
    .filter((e) => claimedById.has(e.shop_id))
    .map((e) => ({
      shop_id: e.shop_id,
      kind: e.kind,
      visitor_hash: visitorHash,
      path: e.path ?? null,
      referrer,
      user_agent: userAgent,
      was_unclaimed: claimedById.get(e.shop_id) === false,
    }))

  if (rows.length > 0) {
    await svc.from('dd_shop_engagement').insert(rows)
  }

  return new NextResponse(null, { status: 204 })
}
