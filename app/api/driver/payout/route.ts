import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { BASE_DELIVERY_PAY, PER_MILE_PAY } from '@/lib/constants'

// GET — fetch driver's payout requests
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (ddUser.role !== 'driver' && ddUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: requests } = await svc.from('dd_payout_requests')
    .select('*')
    .eq('user_id', ddUser.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ requests: requests || [] })
}

// POST — create a new payout request
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role, referral_credit').eq('auth_id', user.id).single()
  if (!ddUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (ddUser.role !== 'driver' && ddUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { allowed } = await checkRateLimit(`payout:${ddUser.id}`, 5, 60000)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const { amount, payment_method, payment_info, notes } = await req.json()

  if (!amount || amount <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  if (!payment_method) return NextResponse.json({ error: 'Payment method required' }, { status: 400 })
  if (!payment_info) return NextResponse.json({ error: 'Payment info required' }, { status: 400 })

  // Check available balance
  const { data: deliveries } = await svc.from('dd_deliveries')
    .select('driver_earnings, base_pay, distance_miles, order:dd_orders(tip)')
    .eq('driver_id', ddUser.id)
    .eq('status', 'delivered')

  const allTimeEarnings = (deliveries || []).reduce((sum, d) => {
    const stored = Number(d.driver_earnings) || 0
    if (stored > 0) return sum + stored
    const basePay = Number(d.base_pay) || BASE_DELIVERY_PAY
    const tip = Number((d.order as any)?.tip) || 0
    const distanceMiles = Number(d.distance_miles) || 0
    return sum + Math.round((basePay + distanceMiles * PER_MILE_PAY + tip) * 100) / 100
  }, 0)

  const { data: existingPayouts } = await svc.from('dd_payout_requests')
    .select('amount, status')
    .eq('user_id', ddUser.id)
    .in('status', ['pending', 'approved', 'paid'])

  const totalPaidOut = (existingPayouts || []).reduce((sum, p) => sum + Number(p.amount), 0)
  // Include referral credit. The earnings page surfaces this to the
  // driver; without adding it here, drivers see it but can never cash it.
  const referralCredit = Number(ddUser.referral_credit) || 0
  const availableBalance = Math.round((allTimeEarnings + referralCredit - totalPaidOut) * 100) / 100

  if (amount > availableBalance) {
    return NextResponse.json({ error: `Amount exceeds available balance ($${availableBalance.toFixed(2)})` }, { status: 400 })
  }

  // Check for pending requests
  const { data: pending } = await svc.from('dd_payout_requests')
    .select('id')
    .eq('user_id', ddUser.id)
    .eq('status', 'pending')
    .limit(1)

  if (pending && pending.length > 0) {
    return NextResponse.json({ error: 'You already have a pending payout request' }, { status: 400 })
  }

  const { data, error } = await svc.from('dd_payout_requests').insert({
    user_id: ddUser.id,
    role: ddUser.role,
    amount,
    payment_method,
    payment_info,
    notes: notes || null,
    status: 'pending',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ request: data })
}
