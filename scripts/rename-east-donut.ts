/**
 * One-off:
 *   1. Rename "East Donut Shop" → "East Texas Donut"
 *   2. Pull the Street View storefront image referenced by
 *      https://maps.app.goo.gl/1N12Y9AwU1E5tZZP8 and set as
 *      image_url + banner_url.
 *
 *   npx tsx scripts/rename-east-donut.ts
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

const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY!
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!GOOGLE_KEY || !SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars'); process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// Extracted from the resolved Google Maps short link
const STREET_VIEW = {
  pano: 'h7j9WlmIAdPp0Cn3isrI8g',
  heading: 48.96,
  pitch: -3.88,
}

const NEW_NAME = 'East Texas Donut'

async function findShop() {
  // Prefer by current slug (after rename) or old name.
  const { data } = await supabase
    .from('dd_shops')
    .select('id, name, slug, image_url, banner_url')
    .or('slug.eq.east-texas-donut,slug.eq.east-donut-shop,name.ilike.%east donut shop%')
  return data || []
}

async function fetchStreetViewImage() {
  // The thumbnail endpoint is what Google Maps itself uses — no API key needed.
  const url = new URL('https://streetviewpixels-pa.googleapis.com/v1/thumbnail')
  url.searchParams.set('cb_client', 'maps_sv.tactile')
  url.searchParams.set('w', '1200')
  url.searchParams.set('h', '800')
  url.searchParams.set('pitch', String(STREET_VIEW.pitch))
  url.searchParams.set('panoid', STREET_VIEW.pano)
  url.searchParams.set('yaw', String(STREET_VIEW.heading))

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`street view fetch: ${res.status}`)
  const contentType = res.headers.get('content-type') || 'image/jpeg'
  const buffer = Buffer.from(await res.arrayBuffer())
  return { buffer, contentType }
}

function extFromContentType(ct: string) {
  if (ct.includes('png')) return 'png'
  if (ct.includes('webp')) return 'webp'
  if (ct.includes('gif')) return 'gif'
  return 'jpg'
}

async function upload(shopId: string, folder: 'logos' | 'banners', buffer: Buffer, contentType: string) {
  const ext = extFromContentType(contentType)
  const path = `${folder}/${shopId}-streetview-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('shop-images').upload(path, buffer, {
    contentType, upsert: true,
  })
  if (error) throw new Error(`${folder} upload: ${error.message}`)
  return supabase.storage.from('shop-images').getPublicUrl(path).data.publicUrl
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

async function ensureUniqueSlug(base: string, ignoreId: string): Promise<string> {
  let slug = base, suffix = 0
  while (suffix < 10) {
    const { data } = await supabase
      .from('dd_shops').select('id').eq('slug', slug).neq('id', ignoreId).maybeSingle()
    if (!data) return slug
    suffix += 1
    slug = `${base}-${suffix}`
  }
  return `${base}-${Date.now().toString(36)}`
}

async function main() {
  const shops = await findShop()
  if (shops.length === 0) {
    console.error('No shop found matching "East Donut Shop"')
    process.exit(1)
  }
  if (shops.length > 1) {
    console.log('Multiple matches:')
    shops.forEach(s => console.log(`  ${s.name} (${s.slug}) ${s.id}`))
  }

  const { buffer, contentType } = await fetchStreetViewImage()
  console.log(`Street View image: ${buffer.length} bytes (${contentType})`)

  for (const shop of shops) {
    console.log(`\nUpdating ${shop.name} (${shop.id})`)

    const logoUrl = await upload(shop.id, 'logos', buffer, contentType)
    const bannerUrl = await upload(shop.id, 'banners', buffer, contentType)

    const newSlug = await ensureUniqueSlug(slugify(NEW_NAME), shop.id)

    const { error: updErr } = await supabase
      .from('dd_shops')
      .update({
        name: NEW_NAME,
        slug: newSlug,
        image_url: logoUrl,
        banner_url: bannerUrl,
      })
      .eq('id', shop.id)

    if (updErr) {
      console.error(`  ! update error: ${updErr.message}`)
      continue
    }

    console.log(`  ✓ name: ${NEW_NAME}`)
    console.log(`  ✓ slug: ${newSlug}`)
    console.log(`  ✓ image_url: ${logoUrl}`)
    console.log(`  ✓ banner_url: ${bannerUrl}`)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
