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

interface TrackBody {
  shop_id: string
  kind: 'page_view' | 'lost_order_click' | 'claim_link_click' | 'menu_item_view' | string
  path?: string
}

const VALID_KINDS = new Set([
  'page_view',
  'lost_order_click',
  'claim_link_click',
  'menu_item_view',
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

  if (!body?.shop_id || !VALID_KINDS.has(body.kind)) {
    // Never 4xx — sendBeacon results are invisible to the client and we
    // don't want noise in browser consoles. Silent no-op on bad input.
    return new NextResponse(null, { status: 204 })
  }

  const svc = createServiceClient()

  // Snapshot the shop's claimed status at write time so retroactive
  // pitch aggregations stay accurate after the shop activates.
  const { data: shop } = await svc
    .from('dd_shops')
    .select('id, is_claimed')
    .eq('id', body.shop_id)
    .maybeSingle()
  if (!shop) {
    // Shop id was bogus — silent drop, no point logging.
    return new NextResponse(null, { status: 204 })
  }

  const ip = clientIp(req)
  const utcDate = new Date().toISOString().slice(0, 10)
  const visitorHash = hashVisitor(ip, utcDate)

  await svc.from('dd_shop_engagement').insert({
    shop_id: body.shop_id,
    kind: body.kind,
    visitor_hash: visitorHash,
    path: body.path ?? null,
    referrer: req.headers.get('referer') ?? null,
    user_agent: req.headers.get('user-agent')?.slice(0, 200) ?? null,
    was_unclaimed: (shop as { is_claimed?: boolean }).is_claimed === false,
  })

  return new NextResponse(null, { status: 204 })
}
