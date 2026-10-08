import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Card charges the terminal approved that never became a sale.
 *
 * This is the report that did not exist when a few transactions showed up in
 * the iPOSpays portal and nowhere in DonutDash. There was no way to ask the
 * question from our side at all: the only record of a card sale was the order
 * row written after approval, so a charge that never produced one left no
 * trace to find.
 *
 * Every row here is money taken from a customer with no sale recorded against
 * it. It should normally be empty.
 */

async function requireAdmin() {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('role').eq('auth_id', user.id).single()
  if (!ddUser || ddUser.role !== 'admin') return { error: 'Forbidden', status: 403 as const }
  return { svc }
}

export async function GET(req: NextRequest) {
  const a = await requireAdmin()
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  // Default to the last 30 days: long enough to catch what was missed,
  // short enough that the page is about today's problem rather than history.
  const days = Math.min(365, Math.max(1, Number(req.nextUrl.searchParams.get('days') ?? 30)))
  const since = new Date(Date.now() - days * 86_400_000).toISOString()

  const { data, error } = await a.svc
    .from('dd_pos_unrecorded_charges')
    .select('*')
    .gte('created_at', since)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data ?? []
  return NextResponse.json({
    days,
    count: rows.length,
    total_cents: rows.reduce((s, r) => s + Number(r.cents ?? 0), 0),
    rows,
  })
}
