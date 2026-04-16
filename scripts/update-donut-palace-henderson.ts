/**
 * One-off: set Donut Palace (700 US-79, Henderson, TX) image + banner
 * from the Street View photo in https://maps.app.goo.gl/4ZXYUGkhHajZQuzc9
 *
 *   npx tsx scripts/update-donut-palace-henderson.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadDotEnvLocal() {
  try {
    const envPath = resolve(process.cwd(), '.env.local')
    const raw = readFileSync(envPath, 'utf8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!(key in process.env)) process.env[key] = value
    }
  } catch { /* noop */ }
}
loadDotEnvLocal()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const STREET_VIEW = {
  pano: 'kFuHsCsbzMUI7n3r_fYzKQ',
  heading: 6.9271064,
  pitch: 0,
}

const CITY = 'Henderson'

function extFromContentType(ct: string) {
  if (ct.includes('png')) return 'png'
  if (ct.includes('webp')) return 'webp'
  if (ct.includes('gif')) return 'gif'
  return 'jpg'
}

async function fetchStreetView() {
  const url = new URL('https://streetviewpixels-pa.googleapis.com/v1/thumbnail')
  url.searchParams.set('cb_client', 'maps_sv.tactile')
  url.searchParams.set('w', '1200')
  url.searchParams.set('h', '800')
  url.searchParams.set('pitch', String(STREET_VIEW.pitch))
  url.searchParams.set('panoid', STREET_VIEW.pano)
  url.searchParams.set('yaw', String(STREET_VIEW.heading))
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Street View fetch: ${res.status}`)
  const contentType = res.headers.get('content-type') || 'image/jpeg'
  return { buffer: Buffer.from(await res.arrayBuffer()), contentType }
}

async function main() {
  // Match Donut Palace in Henderson specifically (there may be several Donut Palaces)
  const { data: shops } = await supabase
    .from('dd_shops')
    .select('id, name, slug, address, city')
    .ilike('name', '%donut palace%')
    .ilike('city', `%${CITY}%`)

  if (!shops || shops.length === 0) {
    console.error(`No Donut Palace found in ${CITY}`)
    process.exit(1)
  }
  if (shops.length > 1) {
    console.log('Multiple matches:')
    shops.forEach(s => console.log(`  ${s.name} — ${s.address}, ${s.city} (${s.id})`))
  }

  console.log('Fetching Street View image...')
  const { buffer, contentType } = await fetchStreetView()
  console.log(`  ${buffer.length} bytes (${contentType})`)

  for (const shop of shops) {
    console.log(`\nUpdating ${shop.name} — ${shop.address}, ${shop.city} (${shop.id})`)
    const ext = extFromContentType(contentType)
    const ts = Date.now()
    const logoPath = `logos/${shop.id}-streetview-${ts}.${ext}`
    const bannerPath = `banners/${shop.id}-streetview-${ts}.${ext}`

    const upA = await supabase.storage.from('shop-images').upload(logoPath, buffer, {
      contentType, upsert: true,
    })
    if (upA.error) { console.error(' ! logo upload:', upA.error.message); continue }

    const upB = await supabase.storage.from('shop-images').upload(bannerPath, buffer, {
      contentType, upsert: true,
    })
    if (upB.error) { console.error(' ! banner upload:', upB.error.message); continue }

    const logoUrl = supabase.storage.from('shop-images').getPublicUrl(logoPath).data.publicUrl
    const bannerUrl = supabase.storage.from('shop-images').getPublicUrl(bannerPath).data.publicUrl

    const { error: updErr } = await supabase
      .from('dd_shops')
      .update({ image_url: logoUrl, banner_url: bannerUrl })
      .eq('id', shop.id)

    if (updErr) { console.error(' ! update error:', updErr.message); continue }

    console.log(`  ✓ image_url: ${logoUrl}`)
    console.log(`  ✓ banner_url: ${bannerUrl}`)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
