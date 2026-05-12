import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const SUPABASE_URL = 'https://hcufceeowohfzhndktne.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjdWZjZWVvd29oZnpobmRrdG5lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzYyNjQ5OSwiZXhwIjoyMDg5MjAyNDk5fQ.p-4kqvyoVCA5qePIzJmdFDcDjY8aAuTtlsQHgzVNzsk'

const svc = createClient(SUPABASE_URL, SERVICE_KEY)
const sqlFile = path.join(__dirname, '..', 'supabase', 'pickup-orders.sql')
const sql = fs.readFileSync(sqlFile, 'utf-8')

async function main() {
  console.log('Attempting to apply via exec_sql RPC...')
  let error: any = null
  try {
    const res = await svc.rpc('exec_sql', { sql_text: sql })
    error = res.error
  } catch (e) {
    error = e
  }
  if (error) {
    console.error('\n❌ Could not apply automatically:', error.message || error)
    console.error('\nApply manually via Supabase Studio → SQL Editor:')
    console.error('https://supabase.com/dashboard/project/hcufceeowohfzhndktne/sql/new\n')
    console.error('--- SQL to paste ---\n' + sql + '\n--- end SQL ---')
    process.exit(1)
  }
  console.log('✅ Migration applied')

  // Verify
  const { data, error: verifyErr } = await svc.from('dd_orders').select('id, fulfillment_type').limit(1)
  if (verifyErr) {
    console.error('Verification failed:', verifyErr.message)
    process.exit(1)
  }
  console.log('Sample row after migration:', data)
}

main()
