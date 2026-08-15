import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hcufceeowohfzhndktne.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjdWZjZWVvd29oZnpobmRrdG5lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzYyNjQ5OSwiZXhwIjoyMDg5MjAyNDk5fQ.p-4kqvyoVCA5qePIzJmdFDcDjY8aAuTtlsQHgzVNzsk'

const svc = createClient(SUPABASE_URL, SERVICE_KEY)

const EMAIL = process.argv[2] || 'Saraydesigner7@gmail.com'

async function main() {
  const { data: users } = await svc.auth.admin.listUsers({ perPage: 1000 })
  const existing = users?.users?.find(u => u.email?.toLowerCase() === EMAIL.toLowerCase())
  if (!existing) {
    console.log('No auth user found for', EMAIL)
    return
  }
  console.log('Auth user:', existing.id, existing.email)

  const { data: ddUser } = await svc.from('dd_users')
    .select('*')
    .eq('auth_id', existing.id)
    .maybeSingle()
  console.log('dd_users:', ddUser)

  if (!ddUser) return

  const { data: docs } = await svc.from('dd_driver_documents')
    .select('doc_type, status, reviewed_at, admin_notes')
    .eq('driver_id', ddUser.id)
  console.log('documents:', docs)
}

main()
