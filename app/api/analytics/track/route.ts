import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

function getDeviceType(ua: string): string {
  if (/tablet|ipad/i.test(ua)) return 'tablet'
  if (/mobile|iphone|android.*mobile/i.test(ua)) return 'mobile'
  return 'desktop'
}

function hashIP(ip: string): string {
  return crypto.createHash('sha256').update(ip + 'donutdash-salt').digest('hex').slice(0, 16)
}

// Extract shop ID from path like /shops/uuid or /shop/uuid/menu
function extractShopId(path: string): string | null {
  const match = path.match(/\/shops?\/([\w-]{36})/)
  return match ? match[1] : null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { path, referrer, sessionId, userId } = body

    if (!path) return NextResponse.json({ ok: true })

    // Get geo data from Vercel headers
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const country = req.headers.get('x-vercel-ip-country') || null
    const region = req.headers.get('x-vercel-ip-country-region') || null
    const city = req.headers.get('x-vercel-ip-city') || null
    const latitude = req.headers.get('x-vercel-ip-latitude')
    const longitude = req.headers.get('x-vercel-ip-longitude')
    const ua = req.headers.get('user-agent') || ''

    const svc = createServiceClient()

    await svc.from('dd_pageviews').insert({
      path,
      referrer: referrer || null,
      user_agent: ua.slice(0, 500),
      ip_hash: hashIP(ip),
      country,
      region,
      city: city ? decodeURIComponent(city) : null,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      shop_id: extractShopId(path),
      user_id: userId || null,
      session_id: sessionId || null,
      device_type: getDeviceType(ua),
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true }) // fail silently
  }
}
