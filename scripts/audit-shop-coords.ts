// Audit dd_shops for coordinates that don't match their address.
//
// For every shop it geocodes the FULL street address via the US Census
// geocoder and compares the result to the stored lat/lng. A shop is flagged
// when its pin is missing, sits outside Texas (for TX shops), or is more than
// THRESHOLD_MI from where its address actually geocodes. Comparing against the
// street address (not a city centroid) avoids false positives from city/county
// name collisions — e.g. the City of Henderson vs. Henderson County.
//
// Read-only: never writes to the database.
// Run:  npx tsx scripts/audit-shop-coords.ts
// Exit code is 1 when any shop is flagged (usable as a CI gate), else 0.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load .env.local (same convention as the other scripts in this folder)
const envPath = join(process.cwd(), '.env.local')
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => {
      const [k, ...rest] = l.split('=')
      return [k.trim(), rest.join('=').trim().replace(/^["']|["']$/g, '')]
    }),
)

const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// A stored pin farther than this from its geocoded address is flagged. Set
// generously so normal interpolation/rooftop error (well under a mile) and a
// suite/plaza offset never trip it, while gross errors (wrong city/state) do.
const THRESHOLD_MI = 8

// Generous Texas bounding box for a fast gross-error check.
const TX = { latMin: 25.5, latMax: 36.6, lngMin: -106.7, lngMax: -93.4 }

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function haversineMi(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

// Geocode a one-line US address via the Census geocoder. Returns null on no match.
async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const url =
    'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress' +
    `?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&format=json`
  try {
    const res = await fetch(url)
    const data = await res.json()
    const m = data?.result?.addressMatches?.[0]
    if (!m?.coordinates) return null
    return { lat: m.coordinates.y, lng: m.coordinates.x }
  } catch {
    return null
  }
}

type Shop = {
  id: string
  name: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  lat: number | null
  lng: number | null
  is_active: boolean | null
}

async function main() {
  const { data: shops, error } = await svc
    .from('dd_shops')
    .select('id, name, address, city, state, zip, lat, lng, is_active')
    .order('name')

  if (error) {
    console.error('Failed to load shops:', error.message)
    process.exit(2)
  }
  if (!shops?.length) {
    console.log('No shops found.')
    return
  }

  console.log(`Auditing ${shops.length} shops (comparing stored pin to geocoded address)...\n`)

  const flagged: { shop: Shop; reasons: string[] }[] = []
  const unverified: Shop[] = []

  for (const shop of shops as Shop[]) {
    const reasons: string[] = []

    if (shop.lat == null || shop.lng == null) {
      flagged.push({ shop, reasons: ['missing coordinates'] })
      continue
    }

    if (
      shop.state === 'TX' &&
      (shop.lat < TX.latMin || shop.lat > TX.latMax || shop.lng < TX.lngMin || shop.lng > TX.lngMax)
    ) {
      reasons.push('coordinates outside Texas')
    }

    const fullAddr = [shop.address, shop.city, shop.state, shop.zip].filter(Boolean).join(', ')
    if (fullAddr) {
      const geo = await geocode(fullAddr)
      await sleep(150) // gentle pacing for the Census API
      if (geo) {
        const d = haversineMi(shop.lat, shop.lng, geo.lat, geo.lng)
        if (d > THRESHOLD_MI) reasons.push(`${d.toFixed(1)} mi from geocoded address`)
      } else if (!reasons.length) {
        // Couldn't confirm the address (common for rural highway addresses).
        // Don't hard-flag — report separately so a human can eyeball it.
        unverified.push(shop)
        continue
      }
    } else if (!reasons.length) {
      reasons.push('no address on file to verify against')
    }

    if (reasons.length) flagged.push({ shop, reasons })
  }

  if (!flagged.length) {
    console.log('✓ No coordinate problems found — every shop plots near its address.')
  } else {
    console.log(`⚠ ${flagged.length} shop(s) flagged:\n`)
    for (const { shop, reasons } of flagged) {
      const addr = [shop.address, shop.city, shop.state, shop.zip].filter(Boolean).join(', ')
      console.log(`  ${shop.name}  [${shop.is_active ? 'active' : 'inactive'}]`)
      console.log(`    ${addr || '(no address)'}`)
      console.log(`    stored: ${shop.lat}, ${shop.lng}`)
      console.log(`    → ${reasons.join('; ')}`)
      console.log(`    id: ${shop.id}\n`)
    }
  }

  if (unverified.length) {
    console.log(`\nℹ ${unverified.length} shop(s) could not be geocoded (address not matched) — verify manually:`)
    for (const shop of unverified) {
      const addr = [shop.address, shop.city, shop.state, shop.zip].filter(Boolean).join(', ')
      console.log(`  - ${shop.name}: ${addr} (${shop.lat}, ${shop.lng})`)
    }
  }

  process.exit(flagged.length ? 1 : 0)
}

main().catch(err => {
  console.error(err)
  process.exit(2)
})
