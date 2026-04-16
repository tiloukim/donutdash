/**
 * Pull storefront photos from Google Places and upload them to
 * Supabase storage as each shop's image + banner.
 *
 * Usage:
 *   npx tsx scripts/fetch-shop-photos.ts
 *
 * Requires in .env.local:
 *   GOOGLE_PLACES_API_KEY=...
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *
 * Targets shops with external_place_id set AND (image_url IS NULL OR
 * banner_url IS NULL). Existing shop images are not overwritten.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ---- .env.local loader (no dotenv dependency) ----------------------------
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

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!GOOGLE_PLACES_API_KEY) {
  console.error('Missing GOOGLE_PLACES_API_KEY in .env.local')
  process.exit(1)
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const PHOTO_MAX_WIDTH = 1200 // store a decent size; Google caps at 1600

interface PlaceDetails {
  photos?: Array<{
    photo_reference: string
    width: number
    height: number
  }>
}

async function getPlacePhotos(placeId: string): Promise<string[]> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json')
  url.searchParams.set('place_id', placeId)
  url.searchParams.set('fields', 'photos')
  url.searchParams.set('key', GOOGLE_PLACES_API_KEY!)

  const res = await fetch(url.toString())
  const data = (await res.json()) as { result?: PlaceDetails; status?: string; error_message?: string }
  if (data.status !== 'OK' || !data.result) {
    console.log(`    ! details error: ${data.status ?? 'unknown'} ${data.error_message ?? ''}`)
    return []
  }
  return (data.result.photos ?? []).map(p => p.photo_reference)
}

async function downloadPhoto(photoReference: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/photo')
  url.searchParams.set('photo_reference', photoReference)
  url.searchParams.set('maxwidth', String(PHOTO_MAX_WIDTH))
  url.searchParams.set('key', GOOGLE_PLACES_API_KEY!)

  const res = await fetch(url.toString(), { redirect: 'follow' })
  if (!res.ok) {
    console.log(`    ! photo fetch ${res.status}`)
    return null
  }
  const contentType = res.headers.get('content-type') || 'image/jpeg'
  const ab = await res.arrayBuffer()
  return { buffer: Buffer.from(ab), contentType }
}

function extFromContentType(contentType: string): string {
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('webp')) return 'webp'
  if (contentType.includes('gif')) return 'gif'
  return 'jpg'
}

async function uploadToStorage(
  shopId: string,
  slot: 'image' | 'banner',
  buffer: Buffer,
  contentType: string
): Promise<string | null> {
  const ext = extFromContentType(contentType)
  const folder = slot === 'banner' ? 'banners' : 'logos'
  const path = `${folder}/${shopId}-google-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('shop-images').upload(path, buffer, {
    contentType,
    upsert: true,
  })
  if (error) {
    console.log(`    ! upload error: ${error.message}`)
    return null
  }
  const { data } = supabase.storage.from('shop-images').getPublicUrl(path)
  return data.publicUrl
}

async function main() {
  console.log('Fetching shops that need Google photos...')
  // Pull unclaimed-or-missing-image shops with a place id
  const { data: shops, error } = await supabase
    .from('dd_shops')
    .select('id, name, external_place_id, image_url, banner_url')
    .not('external_place_id', 'is', null)
    .order('name')

  if (error) {
    console.error('Query error:', error.message)
    process.exit(1)
  }

  const needsPhoto = (shops || []).filter(s => !s.image_url || !s.banner_url)
  console.log(`Shops with place_id: ${shops?.length ?? 0}`)
  console.log(`Shops missing image or banner: ${needsPhoto.length}\n`)

  let updated = 0
  let skipped = 0
  let failed = 0

  for (const shop of needsPhoto) {
    console.log(`• ${shop.name} (${shop.id})`)

    const photoRefs = await getPlacePhotos(shop.external_place_id!)
    if (photoRefs.length === 0) {
      console.log('    skip — no Google photos available')
      skipped += 1
      continue
    }

    // First photo becomes image_url + banner_url (storefront usually first)
    const download = await downloadPhoto(photoRefs[0])
    if (!download) {
      failed += 1
      continue
    }

    const updates: Record<string, string> = {}
    if (!shop.image_url) {
      const url = await uploadToStorage(shop.id, 'image', download.buffer, download.contentType)
      if (url) updates.image_url = url
    }
    if (!shop.banner_url) {
      const url = await uploadToStorage(shop.id, 'banner', download.buffer, download.contentType)
      if (url) updates.banner_url = url
    }

    if (Object.keys(updates).length === 0) {
      failed += 1
      console.log('    ! nothing uploaded')
      continue
    }

    const { error: updErr } = await supabase.from('dd_shops').update(updates).eq('id', shop.id)
    if (updErr) {
      console.log(`    ! db update error: ${updErr.message}`)
      failed += 1
      continue
    }

    console.log(`    ✓ saved ${Object.keys(updates).join(' + ')}`)
    updated += 1

    // Gentle rate-limit for Google's API
    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`\nDone. updated=${updated} skipped=${skipped} failed=${failed}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
