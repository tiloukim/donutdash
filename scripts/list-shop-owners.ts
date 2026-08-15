import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'node:fs'

if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local' })
else dotenv.config()

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

;(async () => {
  const { data: shops, error } = await svc
    .from('dd_shops')
    .select('id, name, owner:dd_users!owner_id(id, email, name)')
    .order('created_at', { ascending: true })
    .limit(10)
  if (error) { console.error(error); process.exit(1) }
  for (const s of shops ?? []) {
    const o = (s as any).owner
    console.log(`shop=${s.name.padEnd(30)} owner=${o?.email ?? '-'} (${o?.id?.slice(0, 8) ?? '-'})`)
  }
})()
