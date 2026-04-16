import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadDotEnvLocal() {
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
}
loadDotEnvLocal()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const sql = readFileSync(resolve(process.cwd(), 'supabase/google-reviews.sql'), 'utf8')
  const { error } = await supabase.rpc('exec_sql', { sql })
  if (error) {
    console.error('Migration failed via rpc:', error.message)
    console.log('\nPlease run supabase/google-reviews.sql manually in the Supabase SQL editor.')
    process.exit(1)
  }
  console.log('✓ Migration executed')
}

main().catch(err => { console.error(err); process.exit(1) })
