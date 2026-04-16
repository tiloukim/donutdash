/**
 * Seed Tyler, TX area donut shops from Google Places API.
 *
 * Usage:
 *   npx tsx scripts/seed-tyler-shops.ts
 *
 * Requires the following in .env.local:
 *   GOOGLE_PLACES_API_KEY=...
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *
 * Inserts all discovered shops into dd_shops as unclaimed rows
 * (owner_id = null, is_claimed = false, is_active = true).
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ---- Simple .env.local loader (no dotenv dependency required) -------------
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
    // No .env.local found — fall back to real env
  }
}
loadDotEnvLocal()

// ---- Config --------------------------------------------------------------
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

const TYLER_LAT = 32.3513
const TYLER_LNG = -95.3011
// 30 miles in meters
const SEARCH_RADIUS_METERS = 30 * 1609.34
const SEARCH_QUERIES = ['donut shop', 'donuts', 'bakery donut']

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// ---- Google Places helpers -----------------------------------------------
interface PlaceSearchResult {
  place_id: string
  name: string
  formatted_address?: string
  geometry?: { location: { lat: number; lng: number } }
}

interface PlaceDetails {
  place_id: string
  name: string
  formatted_address?: string
  formatted_phone_number?: string
  international_phone_number?: string
  geometry?: { location: { lat: number; lng: number } }
  address_components?: Array<{
    long_name: string
    short_name: string
    types: string[]
  }>
}

async function textSearch(query: string): Promise<PlaceSearchResult[]> {
  const results: PlaceSearchResult[] = []
  let pageToken: string | undefined = undefined
  let safety = 0

  do {
    const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
    url.searchParams.set('query', query)
    url.searchParams.set('location', `${TYLER_LAT},${TYLER_LNG}`)
    url.searchParams.set('radius', String(SEARCH_RADIUS_METERS))
    url.searchParams.set('key', GOOGLE_PLACES_API_KEY!)
    if (pageToken) url.searchParams.set('pagetoken', pageToken)

    const res = await fetch(url.toString())
    const data = (await res.json()) as {
      results?: PlaceSearchResult[]
      next_page_token?: string
      status?: string
      error_message?: string
    }

    if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error(`Places API error for "${query}":`, data.status, data.error_message)
      break
    }

    for (const r of data.results || []) results.push(r)

    pageToken = data.next_page_token
    safety += 1
    if (pageToken) {
      // Google requires a short delay before next_page_token becomes valid.
      await new Promise(r => setTimeout(r, 2000))
    }
  } while (pageToken && safety < 5)

  return results
}

async function getDetails(placeId: string): Promise<PlaceDetails | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json')
  url.searchParams.set('place_id', placeId)
  url.searchParams.set(
    'fields',
    'place_id,name,formatted_address,formatted_phone_number,international_phone_number,geometry,address_components'
  )
  url.searchParams.set('key', GOOGLE_PLACES_API_KEY!)

  const res = await fetch(url.toString())
  const data = (await res.json()) as {
    result?: PlaceDetails
    status?: string
    error_message?: string
  }

  if (data.status !== 'OK' || !data.result) {
    console.error(`Details error for ${placeId}:`, data.status, data.error_message)
    return null
  }
  return data.result
}

function extractAddressParts(details: PlaceDetails) {
  const comps = details.address_components || []
  const get = (type: string, short = false) => {
    const c = comps.find(c => c.types.includes(type))
    if (!c) return ''
    return short ? c.short_name : c.long_name
  }

  const streetNumber = get('street_number')
  const route = get('route')
  const address =
    [streetNumber, route].filter(Boolean).join(' ') ||
    (details.formatted_address?.split(',')[0] ?? '')
  const city = get('locality') || get('sublocality') || get('administrative_area_level_2')
  const state = get('administrative_area_level_1', true) || 'TX'
  const zip = get('postal_code')

  return { address, city, state, zip }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function ensureUniqueSlug(base: string): Promise<string> {
  let slug = base
  let suffix = 0
  // Cap at 10 attempts, then fall back to a timestamp.
  while (suffix < 10) {
    const { data } = await supabase.from('dd_shops').select('id').eq('slug', slug).maybeSingle()
    if (!data) return slug
    suffix += 1
    slug = `${base}-${suffix}`
  }
  return `${base}-${Date.now().toString(36)}`
}

// ---- Main ----------------------------------------------------------------
async function main() {
  console.log('Searching Google Places for donut shops near Tyler, TX...')

  // 1. Collect unique place IDs from all text searches
  const placeIdSet = new Set<string>()
  const previewById = new Map<string, PlaceSearchResult>()
  for (const query of SEARCH_QUERIES) {
    console.log(`  Query: "${query}"`)
    const results = await textSearch(query)
    console.log(`    → ${results.length} raw results`)
    for (const r of results) {
      if (!placeIdSet.has(r.place_id)) {
        placeIdSet.add(r.place_id)
        previewById.set(r.place_id, r)
      }
    }
  }

  console.log(`\nUnique places after dedupe: ${placeIdSet.size}`)

  // 2. Check which place IDs are already in the DB
  const placeIds = Array.from(placeIdSet)
  const { data: existing, error: existingErr } = await supabase
    .from('dd_shops')
    .select('external_place_id')
    .in('external_place_id', placeIds)

  if (existingErr) {
    console.error('Error querying existing shops:', existingErr.message)
    process.exit(1)
  }

  const existingSet = new Set((existing || []).map(r => r.external_place_id).filter(Boolean))
  const toInsert = placeIds.filter(id => !existingSet.has(id))

  console.log(`Already in database: ${existingSet.size}`)
  console.log(`New to insert: ${toInsert.length}\n`)

  // 3. For each new place, fetch details and insert
  let added = 0
  let failed = 0

  for (const placeId of toInsert) {
    const preview = previewById.get(placeId)
    const displayName = preview?.name || placeId
    try {
      const details = await getDetails(placeId)
      if (!details) {
        failed += 1
        continue
      }

      const { address, city, state, zip } = extractAddressParts(details)
      const lat = details.geometry?.location.lat ?? null
      const lng = details.geometry?.location.lng ?? null
      const phone =
        details.formatted_phone_number || details.international_phone_number || null

      if (!address || !city) {
        console.log(`  ⏭  Skipping "${displayName}" — missing address/city`)
        failed += 1
        continue
      }

      const baseSlug = slugify(details.name) || slugify(placeId)
      const slug = await ensureUniqueSlug(baseSlug)

      const { error: insertErr } = await supabase.from('dd_shops').insert({
        owner_id: null,
        name: details.name,
        slug,
        address,
        city,
        state: state || 'TX',
        zip: zip || '',
        lat,
        lng,
        phone,
        is_active: true,
        is_claimed: false,
        claim_source: 'google_places',
        external_place_id: placeId,
      })

      if (insertErr) {
        console.error(`  ✗ Insert failed for "${displayName}":`, insertErr.message)
        failed += 1
      } else {
        added += 1
        console.log(`  ✓ Added: ${details.name} (${city}, ${state})`)
      }
    } catch (err) {
      console.error(`  ✗ Error processing "${displayName}":`, err)
      failed += 1
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Total unique places found: ${placeIdSet.size}`)
  console.log(`Already existed:           ${existingSet.size}`)
  console.log(`Newly added:               ${added}`)
  console.log(`Failed / skipped:          ${failed}`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
