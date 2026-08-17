import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendSMS, sendEmail } from '@/lib/sms'

// Weekly nudge (Sunday night) to set aside the sales tax that hasn't been moved
// to the tax account yet. Reminder only — the owner taps Transfer in the Tax
// Center to actually move the money (human stays on the money movement).
const MIN_REMAINING = 1 // don't nag for pennies

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const svc = createServiceClient()

  // Sales tax collected on delivery-service orders (skip refunded), minus what's
  // already been transferred = what still needs to be set aside.
  const { data: orders } = await svc.from('dd_orders')
    .select('tax, refund_amount')
    .neq('status', 'cancelled')
    .in('order_type', ['delivery', 'pickup'])
  const collected = (orders || []).reduce((s, o) => s + (Number(o.refund_amount) > 0 ? 0 : (Number(o.tax) || 0)), 0)

  const { data: xfers } = await svc.from('dd_tax_transfers').select('amount')
  const transferred = (xfers || []).reduce((s, t) => s + Number(t.amount || 0), 0)

  const remaining = Math.round((collected - transferred) * 100) / 100
  if (remaining < MIN_REMAINING) return NextResponse.json({ skipped: true, remaining })

  const { data: admins } = await svc.from('dd_users').select('email, phone').eq('role', 'admin')
  const link = 'https://donutdash.app/admin/tax'
  const amt = `$${remaining.toFixed(2)}`
  const sms = `DonutDash: set aside ${amt} in sales tax this week. Tap to move it to your tax account: ${link}`
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;">
    <div style="background:#FF8C00;padding:20px;text-align:center;border-radius:12px 12px 0 0;color:#fff;font-weight:800;font-size:20px;">DonutDash&trade;</div>
    <div style="border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;padding:24px;">
      <h2 style="margin:0 0 6px;color:#222;font-size:19px;">Set aside this week's sales tax</h2>
      <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 4px;">You've collected sales tax that hasn't been moved to your tax account yet:</p>
      <div style="font-size:34px;font-weight:800;color:#7C2D12;margin:8px 0 14px;">${amt}</div>
      <a href="${link}" style="display:inline-block;padding:12px 28px;background:#EA580C;color:#fff;text-decoration:none;border-radius:8px;font-weight:800;font-size:15px;">Move it to the tax account →</a>
      <p style="color:#888;font-size:12px;margin-top:18px;">Held on behalf of Texas, not income. Confirm remittance with your accountant.</p>
    </div>
  </div>`

  let notified = 0
  for (const a of admins || []) {
    if (a.phone) sendSMS(a.phone as string, sms).catch(() => {})
    if (a.email) sendEmail(a.email as string, `Set aside ${amt} in sales tax`, html).catch(() => {})
    notified++
  }
  return NextResponse.json({ remaining, notified })
}
