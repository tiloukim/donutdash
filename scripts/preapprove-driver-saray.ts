import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hcufceeowohfzhndktne.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjdWZjZWVvd29oZnpobmRrdG5lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzYyNjQ5OSwiZXhwIjoyMDg5MjAyNDk5fQ.p-4kqvyoVCA5qePIzJmdFDcDjY8aAuTtlsQHgzVNzsk'

const svc = createClient(SUPABASE_URL, SERVICE_KEY)

const EMAIL = process.argv[2] || 'saraydesigner7@gmail.com'

const DOC_TYPES = [
  'selfie',
  'drivers_license',
  'drivers_license_back',
  'w9',
  'insurance',
  'vehicle_registration',
  'contractor_agreement',
]

async function main() {
  const { data: users } = await svc.auth.admin.listUsers({ perPage: 1000 })
  const existing = users?.users?.find(u => u.email?.toLowerCase() === EMAIL.toLowerCase())
  if (!existing) {
    console.error('No auth user found for', EMAIL)
    process.exit(1)
  }
  console.log('Auth user:', existing.id)

  const { data: ddUser, error: updErr } = await svc.from('dd_users')
    .update({ driver_status: 'approved', is_active: true })
    .eq('auth_id', existing.id)
    .select()
    .single()
  if (updErr || !ddUser) {
    console.error('dd_users update failed:', updErr?.message)
    process.exit(1)
  }
  console.log('dd_users updated:', ddUser.id, 'driver_status=approved')

  for (const docType of DOC_TYPES) {
    const { error } = await svc.from('dd_driver_documents')
      .upsert({
        driver_id: ddUser.id,
        doc_type: docType,
        file_url: `https://hcufceeowohfzhndktne.supabase.co/storage/v1/object/driver-documents/${ddUser.id}/${docType}-preapproved.png`,
        file_name: `${docType}-preapproved.png`,
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        admin_notes: 'Pre-approved by admin',
      }, { onConflict: 'driver_id,doc_type' })

    if (error) {
      console.error(`  ✗ ${docType}:`, error.message)
    } else {
      console.log(`  ✓ ${docType} — approved`)
    }
  }

  const { data: docs } = await svc.from('dd_driver_documents')
    .select('doc_type, status')
    .eq('driver_id', ddUser.id)
  console.log('\nFinal docs:', docs)
  console.log('\n✅ Done')
}

main()
