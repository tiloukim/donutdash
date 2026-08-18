import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { BASE_DELIVERY_PAY, PER_MILE_PAY } from '@/lib/constants'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'driver' && ddUser.role !== 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: deliveries } = await svc.from('dd_deliveries')
    .select('*, order:dd_orders(*, shop:dd_shops(name), delivery_address, tip)')
    .eq('driver_id', ddUser.id)
    .eq('status', 'delivered')
    .order('delivered_at', { ascending: false })

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString()

  // Trust the stored driver_earnings — that's the figure the weekly payout cron will pay.
  // Only recompute when stored is missing/zero (so the UI always agrees with what hits the bank).
  const all = (deliveries || []).map(d => {
    const stored = Number(d.driver_earnings) || 0
    if (stored > 0) return d
    const tip = Number((d.order as any)?.tip) || 0
    const distanceMiles = Number(d.distance_miles) || 0
    const recomputed = Math.round((BASE_DELIVERY_PAY + distanceMiles * PER_MILE_PAY + tip) * 100) / 100
    return { ...d, driver_earnings: recomputed }
  })

  const today = all.filter(d => d.delivered_at && d.delivered_at >= todayStart).reduce((sum, d) => sum + d.driver_earnings, 0)
  const thisWeek = all.filter(d => d.delivered_at && d.delivered_at >= weekStart).reduce((sum, d) => sum + d.driver_earnings, 0)
  const allTime = all.reduce((sum, d) => sum + d.driver_earnings, 0)

  // Money already paid (or reserved) for this driver comes via TWO paths — both
  // must be subtracted from earnings, or the driver keeps seeing paid money as
  // "available":
  //  1) dd_payout_requests — on-demand instant-payout requests (reserve
  //     pending/approved, and count paid).
  //  2) dd_payout_items — the WEEKLY BATCH payouts. This is the main way drivers
  //     get paid; it was previously ignored here, so a batch-paid driver still
  //     saw their full lifetime earnings as available balance.
  const { data: payouts } = await svc.from('dd_payout_requests')
    .select('amount, status')
    .eq('user_id', ddUser.id)
    .in('status', ['pending', 'approved', 'paid'])
  const requestedOrPaid = (payouts || []).reduce((sum, p) => sum + Number(p.amount), 0)

  const { data: batchItems } = await svc.from('dd_payout_items')
    .select('amount, status')
    .eq('user_id', ddUser.id)
    .eq('user_type', 'driver')
    .eq('status', 'paid')
  const batchPaid = (batchItems || []).reduce((sum, p) => sum + Number(p.amount), 0)

  const totalPaidOut = requestedOrPaid + batchPaid
  const availableBalance = Math.max(0, Math.round((allTime - totalPaidOut) * 100) / 100)

  // Get referral credit
  const referralCredit = Number(ddUser.referral_credit) || 0

  return NextResponse.json({ today, thisWeek, allTime, availableBalance, referralCredit, deliveries: all })
}
