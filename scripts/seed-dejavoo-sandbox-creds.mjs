// Seeds the Top Donuts sandbox Dejavoo credentials into
// dd_shop_terminal_credentials so the POS hydrates them on next launch
// without typing on the Elo touchscreen.
//
// Usage:
//   export DEJAVOO_AUTHKEY='eyJh...<full-jwt>...dyew'
//   node scripts/seed-dejavoo-sandbox-creds.mjs
//   unset DEJAVOO_AUTHKEY   # forget the value once seeded
//
// The AuthKey never touches disk — only lives in your shell session.
// The Supabase row is updated via the service-role key from .env.local.

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local' })

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const AUTHKEY = process.env.DEJAVOO_AUTHKEY

if (!URL || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}
if (!AUTHKEY) {
  console.error('Missing DEJAVOO_AUTHKEY env var. Run:')
  console.error("  export DEJAVOO_AUTHKEY='<paste-token-here>'")
  console.error('then re-run this script.')
  process.exit(1)
}

const sb = createClient(URL, KEY)

const TOP_DONUTS_SHOP_ID = '22222222-2222-2222-2222-222222222222'

const row = {
  shop_id: TOP_DONUTS_SHOP_ID,
  tpn: '264226933512',
  auth_key: AUTHKEY,
  register_id: null,
  environment: 'sandbox',
  terminal_model: 'p8',
  tip_on_terminal: true,
  print_on_terminal: true,
}

const { data, error } = await sb
  .from('dd_shop_terminal_credentials')
  .upsert(row, { onConflict: 'shop_id' })
  .select('shop_id, tpn, environment, terminal_model, tip_on_terminal, print_on_terminal, updated_at')

if (error) {
  console.error('Upsert failed:', error)
  process.exit(1)
}

console.log('Seeded Top Donuts sandbox terminal credentials:')
console.log(data)
console.log('\nNext on the Elo PayPoint: open Settings → Card Terminal — the screen')
console.log('will hydrate TPN + AuthKey from Supabase on load. No typing required.')
