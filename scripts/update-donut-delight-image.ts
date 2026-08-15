/**
 * One-off: replace Donut Delight's image_url + banner_url with a specific
 * Google-hosted photo. Downloads the photo, uploads to Supabase storage,
 * updates the shop row.
 *
 *   npx tsx scripts/update-donut-delight-image.ts
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
  } catch {
    // fall back to real env
  }
}
loadDotEnvLocal()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase env')
  process.exit(1)
}

const SHOP_NAME_ILIKE = 'donut delight'
const SOURCE_URL =
  'https://lh3.googleusercontent.com/gps-cs-s/APNQkAEgtdpK00EorI3d5ObCybQpl9blUcPbPO-TSFumv3SwAFBZBOhwtfvjIg8z4m2H5_TvUuDoEGFAWjQrJFO02Js8D_TsiutSCO6jNDhulOdCmlSKJqm4OeWFYmP1QanyDy4j_L9R=s1360-w1360-h1020-rw'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function extFromContentType(contentType: string): string {
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('webp')) return 'webp'
  if (contentType.includes('gif')) return 'gif'
  return 'jpg'
}

async function main() {
  // 1. Find the shop
  const { data: shops, error } = await supabase
    .from('dd_shops')
    .select('id, name, slug')
    .ilike('name', `%${SHOP_NAME_ILIKE}%`)

  if (error) {
    console.error('Query error:', error.message)
    process.exit(1)
  }
  if (!shops || shops.length === 0) {
    console.error('No shop matching "Donut Delight" found.')
    process.exit(1)
  }
  if (shops.length > 1) {
    console.log('Multiple matches — using the first:')
    shops.forEach(s => console.log(`  ${s.name} (${s.slug}) ${s.id}`))
  }
  const shop = shops[0]
  console.log(`Updating ${shop.name} (${shop.id})...`)

  // 2. Download image
  const res = await fetch(SOURCE_URL, { redirect: 'follow' })
  if (!res.ok) {
    console.error(`Fetch failed: ${res.status}`)
    process.exit(1)
  }
  const contentType = res.headers.get('content-type') || 'image/jpeg'
  const buffer = Buffer.from(await res.arrayBuffer())
  console.log(`  downloaded ${buffer.length} bytes (${contentType})`)

  // 3. Upload to storage (both as logo + banner)
  const ext = extFromContentType(contentType)
  const ts = Date.now()
  const logoPath = `logos/${shop.id}-manual-${ts}.${ext}`
  const bannerPath = `banners/${shop.id}-manual-${ts}.${ext}`

  const { error: uploadErrA } = await supabase.storage.from('shop-images').upload(logoPath, buffer, {
    contentType, upsert: true,
  })
  if (uploadErrA) { console.error('logo upload:', uploadErrA.message); process.exit(1) }

  const { error: uploadErrB } = await supabase.storage.from('shop-images').upload(bannerPath, buffer, {
    contentType, upsert: true,
  })
  if (uploadErrB) { console.error('banner upload:', uploadErrB.message); process.exit(1) }

  const { data: logoUrl } = supabase.storage.from('shop-images').getPublicUrl(logoPath)
  const { data: bannerUrl } = supabase.storage.from('shop-images').getPublicUrl(bannerPath)

  // 4. Update shop row
  const { error: updErr } = await supabase
    .from('dd_shops')
    .update({
      image_url: logoUrl.publicUrl,
      banner_url: bannerUrl.publicUrl,
    })
    .eq('id', shop.id)

  if (updErr) {
    console.error('update error:', updErr.message)
    process.exit(1)
  }

  console.log(`✓ updated`)
  console.log(`  image_url:  ${logoUrl.publicUrl}`)
  console.log(`  banner_url: ${bannerUrl.publicUrl}`)
}

main().catch(err => { console.error(err); process.exit(1) })
