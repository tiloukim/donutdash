import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
function loadEnv() { const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8'); for (const line of raw.split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const eq = t.indexOf('='); if (eq === -1) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(k in process.env)) process.env[k] = v; } }
loadEnv()
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const PHOTO_URL = 'https://lh3.googleusercontent.com/gps-cs-s/APNQkAHStZa1gAtYxxBozYkpTsNyH8W2j8AX03q2WytR-8haO4YxlmpnbJoUgbctED6a5s_5_dygIjHG-AoSkgGSoUeqO51hRYJ9_C5tJyRUoaidKjGzG5tAgAzDfKqXJE9nQJugsV0HzRPUf7eO=s1360-w1360-h1020-rw'

async function main() {
  const { data: shops } = await supabase.from('dd_shops').select('id, name, address').ilike('name', 'fancy donuts')
  if (!shops?.length) { console.error('Not found'); process.exit(1) }
  const shop = shops[0]
  console.log(`Found: ${shop.name} — ${shop.address} (${shop.id})`)

  const res = await fetch(PHOTO_URL, { redirect: 'follow' })
  if (!res.ok) { console.error(`Fetch failed: ${res.status}`); process.exit(1) }
  const buffer = Buffer.from(await res.arrayBuffer())
  const contentType = res.headers.get('content-type') || 'image/jpeg'
  console.log(`Downloaded ${buffer.length} bytes`)

  const ts = Date.now()
  const ext = contentType.includes('webp') ? 'webp' : contentType.includes('png') ? 'png' : 'jpg'
  for (const folder of ['logos', 'banners'] as const) {
    const path = `${folder}/${shop.id}-manual-${ts}.${ext}`
    const { error } = await supabase.storage.from('shop-images').upload(path, buffer, { contentType, upsert: true })
    if (error) { console.error(`${folder}:`, error.message); continue }
    const publicUrl = supabase.storage.from('shop-images').getPublicUrl(path).data.publicUrl
    const field = folder === 'logos' ? 'image_url' : 'banner_url'
    await supabase.from('dd_shops').update({ [field]: publicUrl }).eq('id', shop.id)
    console.log(`✓ ${field}: ${publicUrl}`)
  }
}
main().catch(err => { console.error(err); process.exit(1) })
