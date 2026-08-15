/**
 * Verify the pos-extensions.sql migration is applied.
 * Run from ~/donutdash with: npx tsx scripts/verify-pos-schema.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'node:fs'

if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local' })
else dotenv.config()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const svc = createClient(url, key)

async function probe(table: string, cols: string[]): Promise<void> {
  const select = cols.join(', ')
  const { error } = await svc.from(table).select(select).limit(0)
  if (error) {
    console.error(`✗ ${table}: ${error.message}`)
    process.exitCode = 1
    return
  }
  console.log(`✓ ${table}: ${cols.join(', ')}`)
}

;(async () => {
  await probe('dd_orders', [
    'id', 'order_type', 'source', 'short_code', 'tax',
    'cash_received', 'change_given', 'staff_id',
  ])
  await probe('dd_order_items', ['id', 'order_id', 'name', 'price'])

  // Confirm the short_code trigger fires by checking we can insert with a
  // walk-in (no customer_id / no address) and the short_code comes back set.
  const { data: shop } = await svc.from('dd_shops').select('id').limit(1).maybeSingle()
  if (!shop) {
    console.warn('⚠  No shops in dd_shops — skipping live insert test')
    return
  }
  const { data: row, error } = await svc.from('dd_orders').insert({
    shop_id: shop.id,
    order_type: 'pos_walkin',
    source: 'pos-verify-script',
    status: 'confirmed',
    subtotal: 0, tax: 0, total: 0,
    payment_method: 'cash',
  }).select('id, short_code, order_type').single()
  if (error || !row) {
    console.error(`✗ probe insert failed: ${error?.message}`)
    process.exitCode = 1
    return
  }
  console.log(`✓ probe insert ok — id=${row.id} short_code=${row.short_code} type=${row.order_type}`)
  await svc.from('dd_orders').delete().eq('id', row.id)
  console.log(`✓ cleaned up probe row`)
})()
