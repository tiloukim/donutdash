import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of raw.split('\n')) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('='); if (eq === -1) continue
    const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!(k in process.env)) process.env[k] = v
  }
}
loadEnv()

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const apiKey = process.env.GOOGLE_PLACES_API_KEY
const apply = process.argv.includes('--apply')

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!apiKey) return null
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&components=country:US&key=${apiKey}`
  const res = await fetch(url)
  const data = await res.json()
  if (data.status !== 'OK' || !data.results?.length) return null
  return { lat: data.results[0].geometry.location.lat, lng: data.results[0].geometry.location.lng }
}

async function main() {
  const { data: shops, error } = await supabase
    .from('dd_shops')
    .select('id, name, address, city, state, zip, lat, lng')
    .or('lat.is.null,lng.is.null')
    .order('name')

  if (error) { console.error(error.message); process.exit(1) }
  if (!shops?.length) { console.log('All shops have GPS coordinates set. Nothing to do.'); return }

  console.log(`Found ${shops.length} shop(s) without GPS:\n`)
  for (const s of shops) {
    const fullAddr = [s.address, s.city, s.state, s.zip].filter(Boolean).join(', ')
    console.log(`  ${s.name}`)
    console.log(`    ID:      ${s.id}`)
    console.log(`    Address: ${fullAddr || '(empty)'}`)

    if (!fullAddr) {
      console.log(`    SKIP: address is empty — shop owner must fill it in first`)
      continue
    }
    if (!apiKey) {
      console.log(`    SKIP: GOOGLE_PLACES_API_KEY not set in .env.local`)
      continue
    }

    const coords = await geocode(fullAddr)
    if (!coords) {
      console.log(`    FAIL: geocoder returned no result for "${fullAddr}"`)
      continue
    }
    console.log(`    Geocoded: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`)

    if (!apply) {
      console.log(`    DRY RUN: pass --apply to write to DB`)
      continue
    }

    const { error: updErr } = await supabase
      .from('dd_shops')
      .update({ lat: coords.lat, lng: coords.lng })
      .eq('id', s.id)
    console.log(updErr ? `    ✗ Update failed: ${updErr.message}` : `    ✓ Saved`)
    console.log('')
  }

  console.log(`\nDone.${apply ? '' : ' (dry run — no changes were made; pass --apply to write)'}`)
}

main().catch(err => { console.error(err); process.exit(1) })
