import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
function loadEnv() { const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8'); for (const line of raw.split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const eq = t.indexOf('='); if (eq === -1) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(k in process.env)) process.env[k] = v; } }
loadEnv()
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data: shops } = await supabase.from('dd_shops').select('id, name, address').ilike('name', '%s.k donut%')
  if (!shops?.length) { console.error('Not found'); process.exit(1) }
  const shop = shops[0]
  console.log(`Found: ${shop.name} — ${shop.address} (${shop.id})`)

  const url = new URL('https://streetviewpixels-pa.googleapis.com/v1/thumbnail')
  url.searchParams.set('cb_client', 'maps_sv.tactile')
  url.searchParams.set('w', '1200')
  url.searchParams.set('h', '800')
  url.searchParams.set('pitch', '0.94')
  url.searchParams.set('panoid', 'TbHjXYMEyf-C0l0bNddZZA')
  url.searchParams.set('yaw', '3.96')

  const res = await fetch(url.toString())
  if (!res.ok) { console.error(`Fetch failed: ${res.status}`); process.exit(1) }
  const buffer = Buffer.from(await res.arrayBuffer())
  const contentType = res.headers.get('content-type') || 'image/jpeg'
  console.log(`Downloaded ${buffer.length} bytes`)

  const ts = Date.now()
  for (const folder of ['logos', 'banners'] as const) {
    const path = `${folder}/${shop.id}-streetview-${ts}.jpg`
    const { error } = await supabase.storage.from('shop-images').upload(path, buffer, { contentType, upsert: true })
    if (error) { console.error(`${folder}:`, error.message); continue }
    const publicUrl = supabase.storage.from('shop-images').getPublicUrl(path).data.publicUrl
    const field = folder === 'logos' ? 'image_url' : 'banner_url'
    await supabase.from('dd_shops').update({ [field]: publicUrl }).eq('id', shop.id)
    console.log(`✓ ${field}: ${publicUrl}`)
  }
}
main().catch(err => { console.error(err); process.exit(1) })
