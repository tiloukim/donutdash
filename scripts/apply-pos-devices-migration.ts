import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'node:fs'
import * as path from 'node:path'
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local' })
else dotenv.config()

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'pos-devices.sql'), 'utf-8')

;(async () => {
  let error: any = null
  try {
    const res = await svc.rpc('exec_sql', { sql_text: sql })
    error = res.error
  } catch (e) {
    error = e
  }
  if (error) {
    console.error('❌ Could not apply automatically:', error.message || error)
    console.error('\nPaste this into Supabase Studio → SQL Editor:')
    console.error('https://supabase.com/dashboard/project/hcufceeowohfzhndktne/sql/new\n')
    console.error('--- SQL ---\n' + sql + '\n--- end ---')
    process.exit(1)
  }
  console.log('✅ Migration applied')
  const { error: verifyErr } = await svc.from('dd_pos_devices').select('device_id', { count: 'exact', head: true })
  console.log(verifyErr ? `Verify failed: ${verifyErr.message}` : '✅ dd_pos_devices exists and is queryable')
})()
