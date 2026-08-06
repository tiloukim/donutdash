import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canAccessAdminPortal, isAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

// GET /api/admin/sponsorships — revenue earned from self-serve + admin
// sponsorships, plus who's featured right now.
export async function GET() {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('role').eq('auth_id', user.id).maybeSingle()
  // Financial view — admin + general manager only (same gate as payouts).
  if (!ddUser || !canAccessAdminPortal(ddUser.role) || !(isAdmin(ddUser.role) || ddUser.role === 'general_manager')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: orders } = await svc
    .from('dd_sponsorship_orders')
    .select('id, shop_id, plan, amount, days, starts_at, ends_at, created_at, shop:dd_shops!shop_id(name)')
    .order('created_at', { ascending: false })

  const rows = (orders || []).map(o => ({
    id: o.id,
    shop_name: (o.shop as { name?: string } | null)?.name ?? 'Unknown shop',
    plan: o.plan,
    amount: Number(o.amount),
    days: o.days,
    starts_at: o.starts_at,
    ends_at: o.ends_at,
    created_at: o.created_at,
  }))

  const now = Date.now()
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
  const thirtyAgo = now - 30 * 24 * 60 * 60 * 1000

  const sum = (list: typeof rows) => Math.round(list.reduce((s, r) => s + r.amount, 0) * 100) / 100

  // Currently-featured shops (live sponsors: flagged + un-expired).
  const { data: liveShops } = await svc
    .from('dd_shops')
    .select('id, name, sponsor_rank, sponsor_expires_at')
    .eq('is_sponsored', true)
    .order('sponsor_rank', { ascending: false })

  const activeSponsors = (liveShops || [])
    .filter(s => !s.sponsor_expires_at || new Date(s.sponsor_expires_at).getTime() > now)
    .map(s => ({ id: s.id, name: s.name, rank: s.sponsor_rank ?? 0, expires_at: s.sponsor_expires_at }))

  return NextResponse.json({
    totals: {
      allTime: sum(rows),
      thisMonth: sum(rows.filter(r => new Date(r.created_at).getTime() >= monthStart)),
      last30: sum(rows.filter(r => new Date(r.created_at).getTime() >= thirtyAgo)),
      orderCount: rows.length,
      activeCount: activeSponsors.length,
    },
    activeSponsors,
    orders: rows,
  })
}
