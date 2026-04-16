/**
 * Pull opening hours from Google Places Details for every shop with
 * an external_place_id and upsert into dd_business_hours.
 *
 *   npx tsx scripts/pull-google-hours.ts
 *
 * Google returns opening_hours.periods[] with:
 *   { open: { day: 0-6, time: "HHMM" }, close: { day: 0-6, time: "HHMM" } }
 * where day 0 = Sunday. This matches dd_business_hours.day_of_week.
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

const KEY = process.env.GOOGLE_PLACES_API_KEY!
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

if (!KEY) { console.error('Missing GOOGLE_PLACES_API_KEY'); process.exit(1) }

interface Period {
  open: { day: number; time: string }   // time = "0600"
  close?: { day: number; time: string }  // missing = 24h
}

interface PlaceHours {
  opening_hours?: {
    periods?: Period[]
    weekday_text?: string[]
  }
}

// Convert Google's "HHMM" to "HH:MM" for Postgres time column
function googleTimeToDbTime(t: string): string {
  return `${t.slice(0, 2)}:${t.slice(2)}`
}

async function getHours(placeId: string): Promise<PlaceHours | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json')
  url.searchParams.set('place_id', placeId)
  url.searchParams.set('fields', 'opening_hours')
  url.searchParams.set('key', KEY)
  const res = await fetch(url.toString())
  const data = (await res.json()) as { result?: PlaceHours; status?: string; error_message?: string }
  if (data.status !== 'OK' || !data.result) {
    if (data.status && data.status !== 'ZERO_RESULTS') {
      console.log(`    ! ${data.status} ${data.error_message ?? ''}`)
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

  let updated = 0
  let skipped = 0

  for (const shop of targets) {
    console.log(`• ${shop.name}`)
    const details = await getHours(shop.external_place_id!)
    if (!details?.opening_hours?.periods) {
      console.log('    skip — no hours data')
      skipped += 1
      continue
    }

    const periods = details.opening_hours.periods

    // Check for 24-hour operation: single period with open day=0 time=0000, no close
    const is24h = periods.length === 1 && periods[0].open.time === '0000' && !periods[0].close

    // Build rows for each day of the week (0=Sun..6=Sat)
    const rows: Array<{
      shop_id: string
      day_of_week: number
      open_time: string
      close_time: string
      is_closed: boolean
    }> = []

    if (is24h) {
      // All 7 days, 00:00–23:59
      for (let d = 0; d < 7; d++) {
        rows.push({
          shop_id: shop.id,
          day_of_week: d,
          open_time: '00:00',
          close_time: '23:59',
          is_closed: false,
        })
      }
    } else {
      // Map periods by open.day
      const dayMap = new Map<number, { open: string; close: string }>()
      for (const p of periods) {
        const openTime = googleTimeToDbTime(p.open.time)
        const closeTime = p.close ? googleTimeToDbTime(p.close.time) : '23:59'
        // If a day has multiple periods (rare), use the earliest open / latest close
        const existing = dayMap.get(p.open.day)
        if (existing) {
          if (openTime < existing.open) existing.open = openTime
          if (closeTime > existing.close) existing.close = closeTime
        } else {
          dayMap.set(p.open.day, { open: openTime, close: closeTime })
        }
      }

      for (let d = 0; d < 7; d++) {
        const hours = dayMap.get(d)
        rows.push({
          shop_id: shop.id,
          day_of_week: d,
          open_time: hours?.open ?? '00:00',
          close_time: hours?.close ?? '00:00',
          is_closed: !hours,
        })
      }
    }

    // Upsert (shop_id, day_of_week) is UNIQUE
    const { error: upsertErr } = await supabase
      .from('dd_business_hours')
      .upsert(rows, { onConflict: 'shop_id,day_of_week' })

    if (upsertErr) {
      console.log(`    ! upsert error: ${upsertErr.message}`)
      continue
    }

    // Log readable hours
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const summary = rows.map(r =>
      r.is_closed
        ? `${days[r.day_of_week]}: Closed`
        : `${days[r.day_of_week]}: ${r.open_time}–${r.close_time}`
    ).join(' | ')
    console.log(`    ✓ ${summary}`)
    updated += 1

    await new Promise(r => setTimeout(r, 200))
  }

  console.log(`\nDone. updated=${updated} skipped=${skipped}`)
}

main().catch(err => { console.error(err); process.exit(1) })
