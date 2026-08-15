import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hcufceeowohfzhndktne.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjdWZjZWVvd29oZnpobmRrdG5lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzYyNjQ5OSwiZXhwIjoyMDg5MjAyNDk5fQ.p-4kqvyoVCA5qePIzJmdFDcDjY8aAuTtlsQHgzVNzsk'

const svc = createClient(SUPABASE_URL, SERVICE_KEY)

const PASSWORD = 'Justdoit$911'

const ACCOUNTS = [
  { email: 'saray-manager@donutdash.app', name: 'Saray (Manager)', role: 'manager' as const },
  { email: 'saray-customer@donutdash.app', name: 'Saray (Customer)', role: 'customer' as const },
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
  const { data: list } = await svc.auth.admin.listUsers({ perPage: 1000 })
  const existing = list?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
  if (!existing) throw new Error(`Cannot find or create ${email}: ${error?.message}`)
  console.log(`  = auth exists: ${existing.id}`)
  await svc.auth.admin.updateUserById(existing.id, { password: PASSWORD })
  console.log(`  = password set`)
  return existing.id
}

async function upsertDdUser(authId: string, email: string, name: string, role: 'manager' | 'customer') {
  const { data, error } = await svc.from('dd_users')
    .upsert({ auth_id: authId, email, name, role, is_active: true }, { onConflict: 'auth_id' })
    .select()
    .single()
  if (error) throw new Error(`dd_users upsert failed for ${email}: ${error.message}`)
  console.log(`  + dd_users: ${data.id} (${role})`)
  return data
}

async function main() {
  for (const acc of ACCOUNTS) {
    console.log(`[${acc.role}] ${acc.email}`)
    const authId = await ensureAuthUser(acc.email)
    await upsertDdUser(authId, acc.email, acc.name, acc.role)
    console.log('')
  }
  console.log('Done.')
  console.log('Credentials:')
  console.log(`  password: ${PASSWORD}`)
  console.log(`  driver   → saray@donutdash.app (existing, pre-approved)`)
  for (const acc of ACCOUNTS) console.log(`  ${acc.role.padEnd(8)} → ${acc.email}`)
}

main().catch(err => { console.error(err); process.exit(1) })
