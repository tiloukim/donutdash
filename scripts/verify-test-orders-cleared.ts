/**
 * Read-only check that the targeted test accounts have zero orders/deliveries.
 * Also flags any shops they own and that shop's order count.
 *
 *   npx tsx scripts/verify-test-orders-cleared.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'
import path from 'path'

loadEnv({ path: path.resolve(process.cwd(), '.env.local') })
loadEnv({ path: path.resolve(process.cwd(), '.env') })

const TEST_EMAILS = [
  'cardinkim2010@gmail.com',
  'elifunkysax@gmail.com',
  'tonykim168@gmail.com',
]

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hcufceeowohfzhndktne.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY in env'); process.exit(1) }
const svc = createClient(SUPABASE_URL, SERVICE_KEY)

async function count(table: string, column: string, value: string): Promise<number> {
  const { count, error } = await svc.from(table).select('id', { count: 'exact', head: true }).eq(column, value)
  if (error) { console.error(`  ⚠ ${table}.${column}=${value}: ${error.message}`); return -1 }
  return count || 0
}

async function main() {
  console.log('\n=== Verify cleared test accounts ===\n')

  let totalNonZero = 0

  for (const email of TEST_EMAILS) {
    const { data: u } = await svc.from('dd_users').select('id, name, role').eq('email', email).maybeSingle()
    if (!u) {
      console.log(`${email}  →  no dd_users row`)
      continue
    }
    console.log(`\n${email}  (${u.name || '—'}, role=${u.role}, id=${u.id})`)

    const customerOrders = await count('dd_orders', 'customer_id', u.id)
    console.log(`  orders as customer:   ${customerOrders}`)
    if (customerOrders > 0) totalNonZero += customerOrders

    const driverDeliveries = await count('dd_deliveries', 'driver_id', u.id)
    console.log(`  deliveries as driver: ${driverDeliveries}`)
    if (driverDeliveries > 0) totalNonZero += driverDeliveries

    // Shops owned by this user
    const { data: shops } = await svc.from('dd_shops').select('id, name').eq('owner_id', u.id)
    if (shops && shops.length > 0) {
      for (const shop of shops) {
        const shopOrders = await count('dd_orders', 'shop_id', shop.id)
        console.log(`  shop "${shop.name}" (${shop.id.slice(0, 8)}) orders: ${shopOrders}`)
        if (shopOrders > 0) totalNonZero += shopOrders
      }
    } else {
      console.log(`  shops owned: 0`)
    }
  }

  console.log(`\n=== ${totalNonZero === 0 ? '✅ All zero — cleanup complete' : `⚠ ${totalNonZero} order/delivery rows still present`} ===\n`)
}

main().catch(err => { console.error(err); process.exit(1) })
