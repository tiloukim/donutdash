/**
 * Pull ratings + individual reviews from Google Places Details for every
 * shop with an external_place_id.
 *
 *   npx tsx scripts/pull-google-reviews.ts
 *
 * For each shop:
 *   1. Updates dd_shops.rating (0-5) + dd_shops.review_count
 *   2. Upserts up to 5 individual reviews into dd_google_reviews
 *      (the table must exist; run supabase/google-reviews.sql first)
 *
 * Requires in .env.local: GOOGLE_PLACES_API_KEY, NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY
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
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (!(key in process.env)) process.env[key] = value
    }
  } catch { /* noop */ }
}
loadDotEnvLocal()

const KEY = process.env.GOOGLE_PLACES_API_KEY
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL
const SVC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!KEY || !URL_SB || !SVC_KEY) {
  console.error('Missing env vars'); process.exit(1)
}
const supabase = createClient(URL_SB, SVC_KEY)

interface GoogleReview {
  author_name: string
  author_url?: string
  profile_photo_url?: string
  rating: number
  relative_time_description?: string
  text?: string
  time?: number
  language?: string
}

interface PlaceDetails {
  rating?: number
  user_ratings_total?: number
  reviews?: GoogleReview[]
}

async function getDetails(placeId: string): Promise<PlaceDetails | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json')
  url.searchParams.set('place_id', placeId)
  url.searchParams.set('fields', 'rating,user_ratings_total,reviews')
  url.searchParams.set('reviews_sort', 'newest')
  url.searchParams.set('key', KEY!)
  const res = await fetch(url.toString())
  const data = (await res.json()) as { result?: PlaceDetails; status?: string; error_message?: string }
  if (data.status !== 'OK' || !data.result) {
    if (data.status && data.status !== 'ZERO_RESULTS') {
      console.log(`    ! details error: ${data.status} ${data.error_message ?? ''}`)
    }
    return null
  }
  return data.result
}

async function main() {
  console.log('Loading shops with external_place_id...')
  const { data: shops, error } = await supabase
    .from('dd_shops')
    .select('id, name, external_place_id')
    .not('external_place_id', 'is', null)
    .order('name')

  if (error) { console.error('Query:', error.message); process.exit(1) }

  const targets = (shops || []).filter(s => s.external_place_id)
  console.log(`${targets.length} shops to process\n`)

  let shopsUpdated = 0
  let reviewsUpserted = 0
  let reviewTableMissing = false

  for (const shop of targets) {
    console.log(`• ${shop.name}`)
    const details = await getDetails(shop.external_place_id!)
    if (!details) { continue }

    const shopUpdate: Record<string, number> = {}
    if (typeof details.rating === 'number') {
      shopUpdate.rating = Math.round(details.rating * 10) / 10
    }
    if (typeof details.user_ratings_total === 'number') {
      shopUpdate.review_count = details.user_ratings_total
    }
    if (Object.keys(shopUpdate).length > 0) {
      const { error: updErr } = await supabase
        .from('dd_shops').update(shopUpdate).eq('id', shop.id)
      if (updErr) {
        console.log(`    ! dd_shops update error: ${updErr.message}`)
      } else {
        const parts: string[] = []
        if (shopUpdate.rating !== undefined) parts.push(`${shopUpdate.rating}★`)
        if (shopUpdate.review_count !== undefined) parts.push(`${shopUpdate.review_count} reviews`)
        console.log(`    ✓ ${parts.join(' · ')}`)
        shopsUpdated += 1
      }
    } else {
      console.log('    — no rating data')
    }

    // Upsert individual reviews (up to 5 that Google returns)
    if (!reviewTableMissing && details.reviews && details.reviews.length > 0) {
      const rows = details.reviews.map(r => ({
        shop_id: shop.id,
        author_name: r.author_name,
        author_url: r.author_url ?? null,
        profile_photo_url: r.profile_photo_url ?? null,
        rating: r.rating,
        comment: r.text ?? null,
        relative_time: r.relative_time_description ?? null,
        google_time: r.time ?? null,
        language: r.language ?? null,
      }))
      const { error: insErr } = await supabase
        .from('dd_google_reviews')
        .upsert(rows, { onConflict: 'shop_id,author_name,google_time' })

      if (insErr) {
        if (insErr.message?.toLowerCase().includes('dd_google_reviews') ||
            insErr.code === '42P01') {
          console.log('    ! dd_google_reviews table missing — run supabase/google-reviews.sql')
          reviewTableMissing = true
        } else {
          console.log(`    ! review upsert error: ${insErr.message}`)
        }
      } else {
        reviewsUpserted += rows.length
        console.log(`    ✓ upserted ${rows.length} reviews`)
      }
    }

    // Gentle rate-limit
    await new Promise(r => setTimeout(r, 200))
  }

  console.log(`\nDone. shops updated=${shopsUpdated}  reviews upserted=${reviewsUpserted}`)
  if (reviewTableMissing) {
    console.log('\nIndividual reviews were NOT saved because dd_google_reviews is missing.')
    console.log('Create it by running supabase/google-reviews.sql in the Supabase SQL editor,')
    console.log('then re-run this script.')
  }
}

main().catch(err => { console.error(err); process.exit(1) })
