/**
 * One-off: set East Texas DONUTS (1898 W Cumberland Rd, Tyler, TX) image
 * + banner from the photo in https://maps.app.goo.gl/nbDUSujozo7ZshFw6
 *
 *   npx tsx scripts/update-east-texas-donuts.ts
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

// Photo extracted from the Google Maps short-link resolution;
// request a larger size by rewriting the trailing `=wXX-hYY-k-no`.
const PHOTO_BASE = 'https://lh3.googleusercontent.com/gps-cs-s/APNQkAFI1zaVlJrQZrhbJaRkg_FKiSc2qiE8p-mtmX0LnPGhtYuSirx6G1nzn-tCFi874oRZw7Q3Ysx8KYlxIRx8MgyXUUpurIgFB20lSZRKu8KN2UU-86cVCB12PKmtCZYwNax8-d8'
const PHOTO_URL = `${PHOTO_BASE}=s1360-w1360-h1020-rw`

const ADDRESS_HINT = '1898 W Cumberland'

function extFromContentType(ct: string) {
  if (ct.includes('png')) return 'png'
  if (ct.includes('webp')) return 'webp'
  if (ct.includes('gif')) return 'gif'
  return 'jpg'
}

async function main() {
  // Find the shop — try address first, then fall back to name
  let { data: shops } = await supabase
    .from('dd_shops')
    .select('id, name, slug, address, city')
    .ilike('address', `%${ADDRESS_HINT}%`)

  if (!shops || shops.length === 0) {
    console.log('No shop at that address — matching by name "east texas donuts" instead')
    const fallback = await supabase
      .from('dd_shops')
      .select('id, name, slug, address, city')
      .ilike('name', '%east texas donut%')
    shops = fallback.data || []
  }

  if (!shops || shops.length === 0) {
    console.error('No matching shop found')
    process.exit(1)
  }

  if (shops.length > 1) {
    console.log('Multiple matches:')
    shops.forEach(s => console.log(`  ${s.name} — ${s.address}, ${s.city} (${s.id})`))
  }

  console.log(`Downloading photo...`)
  const res = await fetch(PHOTO_URL, { redirect: 'follow' })
  if (!res.ok) {
    console.error(`Photo fetch failed: ${res.status}`)
    process.exit(1)
  }
  const contentType = res.headers.get('content-type') || 'image/jpeg'
  const buffer = Buffer.from(await res.arrayBuffer())
  console.log(`  ${buffer.length} bytes (${contentType})`)

  for (const shop of shops) {
    console.log(`\nUpdating ${shop.name} — ${shop.address} (${shop.id})`)

    const ext = extFromContentType(contentType)
    const ts = Date.now()
    const logoPath = `logos/${shop.id}-manual-${ts}.${ext}`
    const bannerPath = `banners/${shop.id}-manual-${ts}.${ext}`

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
