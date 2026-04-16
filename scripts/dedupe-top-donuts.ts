// Clean up duplicate Top Donuts shops
// Keeps the claimed one, deletes the unclaimed duplicate
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load .env.local
const envPath = join(process.cwd(), '.env.local')
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => {
      const [k, ...rest] = l.split('=')
      return [k.trim(), rest.join('=').trim().replace(/^["']|["']$/g, '')]
    })
)

const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  // Find all shops named like "Top Donuts"
  const { data: topDonuts } = await svc.from('dd_shops')
    .select('id, name, city, owner_id, is_claimed, created_at, external_place_id')
    .ilike('name', '%top donut%')

  console.log(`Found ${topDonuts?.length || 0} shops matching "Top Donuts":`)
  for (const s of topDonuts || []) {
    console.log(`  - ${s.name} (${s.city}) | claimed: ${s.is_claimed} | id: ${s.id}`)
  }

  // Delete unclaimed duplicates
  const unclaimed = (topDonuts || []).filter(s => s.is_claimed === false)
  if (unclaimed.length === 0) {
    console.log('\nNo unclaimed Top Donuts duplicates to delete.')
    return
  }

  console.log(`\nDeleting ${unclaimed.length} unclaimed Top Donuts shop(s)...`)
  for (const s of unclaimed) {
    const { error } = await svc.from('dd_shops').delete().eq('id', s.id)
    if (error) console.log(`  ✗ Failed to delete ${s.name}: ${error.message}`)
    else console.log(`  ✓ Deleted ${s.name} (${s.city})`)
  }
}

main().catch(console.error)
