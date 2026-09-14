import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { notifyAdmins } from '@/lib/sms'
import { previousWeekWindow, computeWeeklyPayouts, notifyPayoutBatchReady } from '@/lib/payout-week'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/admin/payout-batch/notify   { week_start?: 'YYYY-MM-DD' }
//
// Re-send the weekly payout summary to the admin list, broken out by shop and
// driver. Recomputes from orders and deliveries; it creates nothing, deletes
// nothing, and moves no money.
//
// This exists because the only code path that announced a batch was the one
// that CREATED it, and a week can only be created once. When a batch goes out
// understated — as the week of 2026-09-07 did, reporting $0.00 in shop
// payouts — the only way to re-announce the corrected numbers was to delete
// and regenerate, which destroys the paid/unpaid record of a batch that has
// already been settled. Announcing and rebuilding should never have been the
// same button.

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).maybeSingle()
  if (!ddUser || ddUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { week_start?: string } = {}
  try { body = await req.json() } catch { /* default to last week */ }

  let window = previousWeekWindow(new Date())
  if (body.week_start) {
    // Parse as local midnight, matching how previousWeekWindow builds its
    // bounds — 'YYYY-MM-DD' alone would be read as UTC and shift the window.
    const [y, m, d] = body.week_start.split('-').map(Number)
    if (!y || !m || !d) return NextResponse.json({ error: 'week_start must be YYYY-MM-DD' }, { status: 400 })
    const weekStart = new Date(y, m - 1, d)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)
    window = {
      weekStart, weekEnd,
      weekStartStr: body.week_start,
      weekEndStr: `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, '0')}-${String(weekEnd.getDate()).padStart(2, '0')}`,
    }
  }

  const totals = await computeWeeklyPayouts(svc, window)

  await notifyPayoutBatchReady(notifyAdmins, {
    weekStartStr: window.weekStartStr,
    weekEndStr: window.weekEndStr,
    shopCount: totals.shopEarnings.size,
    driverCount: totals.driverEarnings.size,
    totalShopPayouts: totals.totalShopPayouts,
    totalDriverPayouts: totals.totalDriverPayouts,
    totalAmount: totals.totalAmount,
  })

  return NextResponse.json({
    sent: true,
    week: `${window.weekStartStr}..${window.weekEndStr}`,
    shops: totals.shopEarnings.size,
    drivers: totals.driverEarnings.size,
    totalShopPayouts: Math.round(totals.totalShopPayouts * 100) / 100,
    totalDriverPayouts: Math.round(totals.totalDriverPayouts * 100) / 100,
    totalAmount: totals.totalAmount,
  })
}
