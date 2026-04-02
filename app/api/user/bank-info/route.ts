import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users')
    .select('bank_account_holder, bank_routing_number, bank_account_number')
    .eq('auth_id', user.id)
    .single()

  if (!ddUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  return NextResponse.json({ bankInfo: ddUser })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { bank_account_holder, bank_routing_number, bank_account_number } = await req.json()

  const { error } = await svc.from('dd_users')
    .update({ bank_account_holder, bank_routing_number, bank_account_number })
    .eq('auth_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
