/**
 * One-off: copy banner_url → image_url for specific shops so the
 * landing-page shop card uses the current banner photo as its logo.
 *
 *   npx tsx scripts/copy-banner-to-logo.ts
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
  } catch { /* fall back to real env */ }
}
loadDotEnvLocal()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SHOP_PATTERNS = ['top donut', 'lindale donut']

async function main() {
  for (const pattern of SHOP_PATTERNS) {
    const { data: shops, error } = await supabase
      .from('dd_shops')
      .select('id, name, image_url, banner_url')
      .ilike('name', `%${pattern}%`)

    if (error) {
      console.error(`Query error for "${pattern}":`, error.message)
      continue
    }
    if (!shops || shops.length === 0) {
      console.log(`No shops matching "${pattern}"`)
      continue
    }

    for (const shop of shops) {
      if (!shop.banner_url) {
        console.log(`- ${shop.name}: no banner_url, skipping`)
        continue
      }
      const { error: updErr } = await supabase
        .from('dd_shops')
        .update({ image_url: shop.banner_url })
        .eq('id', shop.id)

      if (updErr) {
        console.log(`- ${shop.name}: update error ${updErr.message}`)
      } else {
        console.log(`✓ ${shop.name}: image_url set from banner_url`)
        console.log(`    ${shop.banner_url}`)
      }
    }
  }
}

main().catch(err => { console.error(err); process.exit(1) })
