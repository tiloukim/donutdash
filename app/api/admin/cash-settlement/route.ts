import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// Cross-store DonutDash Cash settlement.
//
//   GET  ?from=&to=   what is owed for a period, gross and netted
//   POST { from, to } record those obligations as pending rows
//   PATCH { id, status, payment_reference } mark one paid or void
//
// Admin only. This decides money between shops, which is not a shop owner's
// call to make about their own debts.
//
// NOTHING here moves money. It works out who owes whom and records it; the
// transfer happens by whatever means the platform settles on, and PATCH is
// how somebody says it happened.

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('role').eq('auth_id', user.id).single()
  if (!ddUser || ddUser.role !== 'admin') return { error: 'Forbidden', status: 403 as const }
  return { svc, userId: user.id }
}

export async function GET(req: NextRequest) {
  const a = await requireAdmin()
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')
  if (!from || !to) {
    return NextResponse.json({ error: 'from and to are required' }, { status: 400 })
  }

  const [lines, net, platform] = await Promise.all([
    a.svc.from('dd_cash_settlements')
      .select('*')
      .gte('period_start', from)
      .lte('period_end', to)
      .order('amount_cents', { ascending: false }),
    a.svc.from('dd_cash_settlement_net').select('*'),
    a.svc.from('dd_cash_platform_liability').select('unfunded_cents').maybeSingle(),
  ])

  return NextResponse.json({
    settlements: lines.data ?? [],
    net: net.data ?? [],
    // Balances no shop funded — the converted points, and any future
    // platform-funded promotion. Real money owed to customers, just not any
    // single shop's, so it is reported apart from the per-shop figures.
    platform_liability_cents: Number(platform.data?.unfunded_cents ?? 0),
  })
}

export async function POST(req: NextRequest) {
  const a = await requireAdmin()
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  let body: { from?: string; to?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.from || !body.to) {
    return NextResponse.json({ error: 'from and to are required' }, { status: 400 })
  }

  // Idempotent by period and pair: re-running a week updates pending amounts
  // rather than billing twice, and never edits a row already marked paid.
  const { data, error } = await a.svc.rpc('dd_cash_settlement_prepare', {
    p_from: body.from,
    p_to: body.to,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settlements: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  const a = await requireAdmin()
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  let body: { id?: string; status?: string; payment_reference?: string; notes?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.id || !body.status) {
    return NextResponse.json({ error: 'id and status are required' }, { status: 400 })
  }
  if (!['pending', 'paid', 'void'].includes(body.status)) {
    return NextResponse.json({ error: 'status must be pending, paid or void' }, { status: 400 })
  }

  const { data, error } = await a.svc
    .from('dd_cash_settlements')
    .update({
      status: body.status,
      paid_at: body.status === 'paid' ? new Date().toISOString() : null,
      payment_reference: body.payment_reference ?? null,
      notes: body.notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settlement: data })
}
