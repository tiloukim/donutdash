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
  console.log('auth_id:', authUser?.id)
  const { data: dd } = await svc.from('dd_users').select('*').eq('auth_id', authUser?.id ?? '').maybeSingle()
  console.log('dd_users:', dd)
  if (dd) {
    const { data: shops } = await svc.from('dd_shops').select('id, name, owner_id').eq('owner_id', dd.id)
    console.log('shops where owner_id =', dd.id, ':', shops)
  }
})()
