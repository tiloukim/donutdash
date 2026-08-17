import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { listMercuryAccounts, mercuryConfigured } from '@/lib/mercury'

export const dynamic = 'force-dynamic'

// GET — Mercury accounts (for the source/destination pickers) + how much sales
// tax has already been transferred, so the Tax Center can show "remaining".
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('role').eq('auth_id', user.id).single()
  if (!ddUser || ddUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: transfers } = await svc.from('dd_tax_transfers').select('amount, created_at, note').order('created_at', { ascending: false })
  const transferredTotal = Math.round((transfers || []).reduce((s, t) => s + Number(t.amount || 0), 0) * 100) / 100

  if (!mercuryConfigured()) {
    return NextResponse.json({ configured: false, accounts: [], transferredTotal, recentTransfers: transfers || [] })
  }
  try {
    const accounts = await listMercuryAccounts()
    return NextResponse.json({ configured: true, accounts, transferredTotal, recentTransfers: transfers || [] })
  } catch (e) {
    return NextResponse.json({ configured: true, accounts: [], transferredTotal, recentTransfers: transfers || [], error: e instanceof Error ? e.message : 'Mercury error' })
  }
}
