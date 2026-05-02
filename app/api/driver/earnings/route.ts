import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

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

  // Compute correct earnings: base_pay + distance bonus + tip
  const all = (deliveries || []).map(d => {
    const basePay = d.base_pay || 2.50
    const tip = (d.order as any)?.tip || 0
    const distanceMiles = d.distance_miles || 2
    const storedEarnings = d.driver_earnings || 4.00
    const calculatedEarnings = basePay + (distanceMiles * 2 * 0.75) + tip
    // Use the higher of stored vs calculated (in case stored was the $4 fallback)
    const actualEarnings = Math.max(storedEarnings, Math.round(calculatedEarnings * 100) / 100)
    return { ...d, driver_earnings: actualEarnings }
  })

  const today = all.filter(d => d.delivered_at && d.delivered_at >= todayStart).reduce((sum, d) => sum + d.driver_earnings, 0)
  const thisWeek = all.filter(d => d.delivered_at && d.delivered_at >= weekStart).reduce((sum, d) => sum + d.driver_earnings, 0)
  const allTime = all.reduce((sum, d) => sum + d.driver_earnings, 0)

  // Calculate total paid out + pending payouts
  const { data: payouts } = await svc.from('dd_payout_requests')
    .select('amount, status')
    .eq('user_id', ddUser.id)
    .in('status', ['pending', 'approved', 'paid'])

  const totalPaidOut = (payouts || []).reduce((sum, p) => sum + Number(p.amount), 0)
  const availableBalance = Math.max(0, Math.round((allTime - totalPaidOut) * 100) / 100)

  // Get referral credit
  const referralCredit = Number(ddUser.referral_credit) || 0

  return NextResponse.json({ today, thisWeek, allTime, availableBalance, referralCredit, deliveries: all })
}
