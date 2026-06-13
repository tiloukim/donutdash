import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canAccessAdminPortal } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('role').eq('auth_id', user.id).single()
  if (!ddUser || (!canAccessAdminPortal(ddUser.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const page = parseInt(req.nextUrl.searchParams.get('page') || '1')
  const limit = 50
  const offset = (page - 1) * limit
  const search = req.nextUrl.searchParams.get('search') || ''

  let query = svc.from('dd_pageviews')
    .select('id, path, referrer, ip_hash, country, region, city, device_type, session_id, user_agent, user_id, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.or(`ip_hash.ilike.%${search}%,city.ilike.%${search}%,path.ilike.%${search}%,session_id.ilike.%${search}%`)
  }

  const { data: visitors, count } = await query

  // Fetch user names for logged-in visitors
  const userIds = [...new Set((visitors || []).map(v => v.user_id).filter(Boolean))]
  let userMap: Record<string, { name: string; email: string; role: string }> = {}
  if (userIds.length > 0) {
    const { data: users } = await svc.from('dd_users').select('id, name, email, role').in('id', userIds)
    users?.forEach(u => { userMap[u.id] = { name: u.name, email: u.email, role: u.role } })
  }

  const enrichedVisitors = (visitors || []).map(v => ({
    ...v,
    user: v.user_id ? userMap[v.user_id] || null : null,
  }))

  return NextResponse.json({
    visitors: enrichedVisitors,
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  })
}
