import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'node:fs'

if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local' })
else dotenv.config()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const svc = createClient(SUPABASE_URL, SERVICE_KEY)

const PASSWORD = 'DonutDashDemo2026!'

const ACCOUNTS = [
  { email: 'demo-customer@donutdash.app', name: 'Demo Customer', role: 'customer' as const },
  { email: 'demo-driver@donutdash.app', name: 'Demo Driver', role: 'driver' as const },
  { email: 'demo-shop@donutdash.app', name: 'Demo Shop Owner', role: 'shop_owner' as const },
]

const DRIVER_DOC_TYPES = [
  'selfie',
  'drivers_license',
  'drivers_license_back',
  'w9',
  'insurance',
  'vehicle_registration',
  'contractor_agreement',
]

async function ensureAuthUser(email: string): Promise<string> {
  const { data: authData, error } = await svc.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })
  if (!error && authData?.user) {
    console.log(`  + auth created: ${authData.user.id}`)
    return authData.user.id
  }
  // Already exists — look it up
  const { data: list } = await svc.auth.admin.listUsers({ perPage: 1000 })
  const existing = list?.users?.find(u => u.email === email)
  if (!existing) throw new Error(`Cannot find or create auth user for ${email}: ${error?.message}`)
  console.log(`  = auth exists: ${existing.id}`)
  // Reset password so demo password always works
  await svc.auth.admin.updateUserById(existing.id, { password: PASSWORD })
  return existing.id
}

async function upsertDdUser(authId: string, email: string, name: string, role: 'customer' | 'driver' | 'shop_owner') {
  const row: Record<string, unknown> = {
    auth_id: authId,
    email,
    name,
    role,
    is_active: true,
  }
  if (role === 'driver') row.driver_status = 'approved'

  const { data, error } = await svc.from('dd_users')
    .upsert(row, { onConflict: 'auth_id' })
    .select()
    .single()
  if (error) throw new Error(`dd_users upsert failed for ${email}: ${error.message}`)
  console.log(`  + dd_users: ${data.id} (${role})`)
  return data
}

async function upsertDriverDocs(driverId: string) {
  for (const docType of DRIVER_DOC_TYPES) {
    const { error } = await svc.from('dd_driver_documents').upsert({
      driver_id: driverId,
      doc_type: docType,
      file_url: `https://hcufceeowohfzhndktne.supabase.co/storage/v1/object/driver-documents/${driverId}/${docType}-demo.png`,
      file_name: `${docType}-demo.png`,
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      admin_notes: 'Pre-approved demo account',
    }, { onConflict: 'driver_id,doc_type' })
    if (error) console.error(`  ! doc ${docType} failed: ${error.message}`)
    else console.log(`  + doc ${docType}: approved`)
  }
}

async function upsertDemoShop(ownerId: string) {
  const shopRow = {
    owner_id: ownerId,
    name: 'Demo Donuts',
    slug: 'demo-donuts',
    description: 'A demo shop for testing the DonutDash experience.',
    address: '123 Demo Street',
    city: 'Tyler',
    state: 'TX',
    zip: '75701',
    phone: '(555) 123-4567',
    is_active: true,
  }
  const { data: existing } = await svc.from('dd_shops').select('id').eq('slug', shopRow.slug).maybeSingle()
  if (existing) {
    const { data, error } = await svc.from('dd_shops').update(shopRow).eq('id', existing.id).select().single()
    if (error) throw new Error(`dd_shops update failed: ${error.message}`)
    console.log(`  = shop exists, updated: ${data.id}`)
    return data
  }
  const { data, error } = await svc.from('dd_shops').insert(shopRow).select().single()
  if (error) throw new Error(`dd_shops insert failed: ${error.message}`)
  console.log(`  + shop created: ${data.id}`)
  return data
}

async function main() {
  console.log('Creating demo accounts...\n')

  for (const acc of ACCOUNTS) {
    console.log(`[${acc.role}] ${acc.email}`)
    const authId = await ensureAuthUser(acc.email)
    const ddUser = await upsertDdUser(authId, acc.email, acc.name, acc.role)

    if (acc.role === 'driver') {
      await upsertDriverDocs(ddUser.id)
    }
    if (acc.role === 'shop_owner') {
      await upsertDemoShop(ddUser.id)
    }
    console.log('')
  }

  console.log('Done.\n')
  console.log('Demo credentials:')
  console.log(`  password: ${PASSWORD}`)
  for (const acc of ACCOUNTS) {
    console.log(`  ${acc.role.padEnd(11)} → ${acc.email}`)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
