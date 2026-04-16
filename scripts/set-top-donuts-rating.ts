import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadDotEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local')
  const raw = readFileSync(envPath, 'utf8')
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!(k in process.env)) process.env[k] = v
  }
}
loadDotEnvLocal()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const { data: shops } = await supabase
    .from('dd_shops').select('id, name, slug').ilike('name', '%top donut%')

  if (!shops || shops.length === 0) { console.error('No Top Donuts found'); process.exit(1) }

  for (const s of shops) {
    const { error } = await supabase
      .from('dd_shops')
      .update({ rating: 4.9, review_count: 289 })
      .eq('id', s.id)
    if (error) console.error(`  ! ${s.name}: ${error.message}`)
    else console.log(`✓ ${s.name} (${s.slug}) → 4.9★ · 289 reviews`)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
