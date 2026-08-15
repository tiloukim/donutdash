import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hcufceeowohfzhndktne.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjdWZjZWVvd29oZnpobmRrdG5lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzYyNjQ5OSwiZXhwIjoyMDg5MjAyNDk5fQ.p-4kqvyoVCA5qePIzJmdFDcDjY8aAuTtlsQHgzVNzsk'

const svc = createClient(SUPABASE_URL, SERVICE_KEY)

const EMAIL = 'driver-review@donutdash.app'
const PASSWORD = 'DonutDash2026!'
const NAME = 'Apple Reviewer Driver'

async function main() {
  // 1. Create auth user
  console.log('Creating auth user...')
  const { data: authData, error: authErr } = await svc.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  })
  if (authErr) {
    // User might already exist
    console.log('Auth error (may already exist):', authErr.message)
    const { data: users } = await svc.auth.admin.listUsers()
    const existing = users?.users?.find(u => u.email === EMAIL)
    if (!existing) { console.error('Cannot find or create user'); process.exit(1) }
    console.log('Found existing auth user:', existing.id)
    await setup(existing.id)
    return
  }
  console.log('Auth user created:', authData.user.id)
  await setup(authData.user.id)
}

async function setup(authId: string) {
  // 2. Create dd_users record
  console.log('Creating dd_users record...')
  const { data: ddUser, error: ddErr } = await svc.from('dd_users')
    .upsert({
      auth_id: authId,
      email: EMAIL,
      name: NAME,
      role: 'driver',
      is_active: true,
      driver_status: 'approved',
    }, { onConflict: 'auth_id' })
    .select()
    .single()

  if (ddErr) { console.error('dd_users error:', ddErr.message); process.exit(1) }
  console.log('dd_users record:', ddUser.id)

  // 3. Insert 7 approved documents
  const docTypes = [
    'selfie',
    'drivers_license',
    'drivers_license_back',
    'w9',
    'insurance',
    'vehicle_registration',
    'contractor_agreement',
  ]

  console.log('Inserting approved documents...')
  for (const docType of docTypes) {
    const { error } = await svc.from('dd_driver_documents')
      .upsert({
        driver_id: ddUser.id,
        doc_type: docType,
        file_url: `https://hcufceeowohfzhndktne.supabase.co/storage/v1/object/driver-documents/${ddUser.id}/${docType}-review.png`,
        file_name: `${docType}-review.png`,
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        admin_notes: 'Pre-approved for App Store review',
      }, { onConflict: 'driver_id,doc_type' })

    if (error) {
      console.error(`Error inserting ${docType}:`, error.message)
    } else {
      console.log(`  ✓ ${docType} — approved`)
    }
  }

  console.log('\n✅ Driver review account ready!')
  console.log(`   Email: ${EMAIL}`)
  console.log(`   Password: ${PASSWORD}`)
  console.log(`   Role: driver (approved)`)
  console.log(`   Documents: 7/7 approved`)
}

main()
