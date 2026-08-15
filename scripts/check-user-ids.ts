import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'node:fs'
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local' })
else dotenv.config()
const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
;(async () => {
  const email = 'tiloukim@gmail.com'
  const { data: authList } = await svc.auth.admin.listUsers()
  const authUser = authList?.users.find(u => u.email === email)
  console.log('auth.users.id     =', authUser?.id)
  const { data: ddByAuthId } = await svc.from('dd_users').select('id, email, role, auth_id').eq('id', authUser?.id ?? '').maybeSingle()
  console.log('dd_users by id    =', ddByAuthId)
  const { data: ddByEmail } = await svc.from('dd_users').select('id, email, role').eq('email', email).maybeSingle()
  console.log('dd_users by email =', ddByEmail)
  const { data: ddByAuthFk } = await svc.from('dd_users').select('id, email, role').eq('auth_id', authUser?.id ?? '').maybeSingle()
  console.log('dd_users by auth_id=', ddByAuthFk)
})()
