import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { notifyAdmins } from '@/lib/sms'
import { pushAdmins } from '@/lib/push-server'
import { previousWeekWindow, computeWeeklyPayouts } from '@/lib/payout-week'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Sunday-night reminder to move money into the bank before the ACH run.
//
// weekly-payout builds the batch Monday 06:00 CT. If the funds aren't in the
// account by then the batch is created but the transfers can't clear, and
// nobody finds out until a driver or shop owner asks where their money is.
//
// Runs Monday 00:00 UTC — Sunday 7 PM CT (6 PM CST) — which is the same
// Mon-Sun window weekly-payout will batch six hours later. It quotes the
// figure from the SAME function that cron uses, so the amount in the text is
// the amount that will actually go out.
//
// Read-only: it creates no batch and moves nothing.

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()
  // Monday 00:00 UTC is already "Monday" to the server, so the previous-week
  // window resolves to the Mon-Sun that just ended — the one being paid.
  const window = previousWeekWindow(new Date())
  const totals = await computeWeeklyPayouts(svc, window)

  // Already funded and batched (a manual early run) — don't nag.
  const { data: existing } = await svc
    .from('dd_payout_batches')
    .select('id, status')
    .eq('week_start', window.weekStartStr)
    .maybeSingle()

  if (totals.totalAmount <= 0) {
    return NextResponse.json({ skipped: 'nothing to pay', week: window.weekStartStr })
  }

  const money = (n: number) => `$${n.toFixed(2)}`
  const drivers = totals.driverEarnings.size
  const shops = totals.shopEarnings.size
  const already = existing ? ` (batch already created, status ${existing.status})` : ''

  const sms =
    `ACH FUNDING DUE — transfer ${money(totals.totalAmount)} to the payout account tonight.\n` +
    `Week ${window.weekStartStr} to ${window.weekEndStr}${already}\n` +
    `Drivers ${money(totals.totalDriverPayouts)} (${drivers})  |  Shops ${money(totals.totalShopPayouts)} (${shops})\n` +
    `Payout runs Monday 6 AM CT. donutdash.app/admin/payouts`

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:20px;">
      <h2 style="color:#FF8C00;margin-bottom:2px;">ACH funding due tonight</h2>
      <p style="color:#666;font-size:13px;margin-top:0;">Week of ${window.weekStartStr} &ndash; ${window.weekEndStr}${already}</p>
      <div style="background:#FFF8F0;border:1px solid #FFE8D6;border-radius:12px;padding:18px;margin:16px 0;">
        <div style="font-size:32px;font-weight:800;color:#10B981;">${money(totals.totalAmount)}</div>
        <div style="font-size:13px;color:#666;margin-top:4px;">needs to be in the payout account before Monday 6&nbsp;AM CT</div>
      </div>
      <table style="width:100%;font-size:14px;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#555;">Drivers (${drivers})</td><td align="right"><strong>${money(totals.totalDriverPayouts)}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#555;">Shops (${shops})</td><td align="right"><strong>${money(totals.totalShopPayouts)}</strong></td></tr>
        <tr><td style="padding:10px 0;border-top:2px solid #eee;"><strong>Total</strong></td><td align="right" style="border-top:2px solid #eee;"><strong>${money(totals.totalAmount)}</strong></td></tr>
      </table>
      <p style="font-size:13px;color:#666;line-height:1.6;">
        The weekly payout batch is built automatically at 6&nbsp;AM CT Monday. If the funds
        aren't in the account by then the transfers can't clear, and the first anyone hears
        of it is a driver asking where their money is.
      </p>
      <a href="https://donutdash.app/admin/payouts" style="display:inline-block;margin-top:8px;padding:12px 24px;background:#FF8C00;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">Review payouts</a>
    </div>`

  await notifyAdmins(sms, `ACH funding due: ${money(totals.totalAmount)} before Monday 6 AM`, html)
  pushAdmins(`Fund ${money(totals.totalAmount)} tonight`, `ACH payout runs Monday 6 AM CT`, '/admin/payouts').catch(() => {})

  return NextResponse.json({
    week: `${window.weekStartStr}..${window.weekEndStr}`,
    totalAmount: totals.totalAmount,
    drivers,
    shops,
    batchExists: !!existing,
  })
}
