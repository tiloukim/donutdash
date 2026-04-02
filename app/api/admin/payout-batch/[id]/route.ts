import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || ddUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: batch } = await svc.from('dd_payout_batches').select('*').eq('id', id).single()
  if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })

  const { data: items } = await svc.from('dd_payout_items')
    .select('*, user:dd_users!user_id(name, email, phone), shop:dd_shops!shop_id(name)')
    .eq('batch_id', id)
    .order('user_type', { ascending: true })
    .order('amount', { ascending: false })

  return NextResponse.json({ batch, items: items || [] })
}
