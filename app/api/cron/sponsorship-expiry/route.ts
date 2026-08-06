import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail, sendSMS } from '@/lib/sms'

// Days before a feature ends that we send the renewal reminder.
const REMIND_WINDOW_DAYS = 3

function emailShell(title: string, body: string) {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;">
      <div style="background:#FF8C00;padding:22px 20px;text-align:center;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">DonutDash</h1>
      </div>
      <div style="padding:24px 20px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;">
        <h2 style="margin:0 0 12px;color:#222;font-size:19px;">${title}</h2>
        ${body}
        <a href="https://donutdash.app/shop/promote" style="display:inline-block;margin-top:18px;padding:12px 26px;background:#FF8C00;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">Renew your feature</a>
      </div>
    </div>`
}

async function notifyOwner(svc: ReturnType<typeof createServiceClient>, ownerId: string, subject: string, html: string, sms: string) {
  const { data: owner } = await svc.from('dd_users').select('email, phone').eq('id', ownerId).maybeSingle()
  if (owner?.email) await sendEmail(owner.email, subject, html).catch(() => {})
  if (owner?.phone) {
    const p = owner.phone.startsWith('+') ? owner.phone : `+1${owner.phone.replace(/\D/g, '')}`
    sendSMS(p, sms).catch(() => {})
  }
}

// Daily: remind shops whose feature is about to end, and turn off features
// that have already lapsed.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()
  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const windowIso = new Date(now + REMIND_WINDOW_DAYS * 86400000).toISOString()

  // 1) Lapsed features → flip is_sponsored off + let the shop know it ended.
  const { data: expired } = await svc
    .from('dd_shops')
    .select('id, name, owner_id, sponsor_expires_at')
    .eq('is_sponsored', true)
    .lt('sponsor_expires_at', nowIso)

  for (const shop of expired || []) {
    await svc.from('dd_shops').update({ is_sponsored: false }).eq('id', shop.id)
    if (shop.owner_id) {
      await notifyOwner(svc, shop.owner_id,
        `Your DonutDash feature has ended`,
        emailShell('Your feature has ended',
          `<p style="color:#444;font-size:15px;line-height:1.6;margin:0;">${shop.name} is no longer featured on the DonutDash front page. Renew any time to get back on top of the shop list and into the banner rotation.</p>`),
        `Your DonutDash feature for ${shop.name} has ended. Renew: donutdash.app/shop/promote`,
      )
    }
  }

  // 2) Ending soon (within the window) and not yet reminded for THIS expiry.
  const { data: soon } = await svc
    .from('dd_shops')
    .select('id, name, owner_id, sponsor_expires_at, sponsor_reminded_for')
    .eq('is_sponsored', true)
    .gte('sponsor_expires_at', nowIso)
    .lte('sponsor_expires_at', windowIso)

  let reminded = 0
  for (const shop of soon || []) {
    const alreadyReminded = shop.sponsor_reminded_for &&
      new Date(shop.sponsor_reminded_for).getTime() === new Date(shop.sponsor_expires_at).getTime()
    if (alreadyReminded || !shop.owner_id) continue

    const daysLeft = Math.max(1, Math.ceil((new Date(shop.sponsor_expires_at).getTime() - now) / 86400000))
    const endStr = new Date(shop.sponsor_expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    await notifyOwner(svc, shop.owner_id,
      `Your DonutDash feature ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
      emailShell(`Your feature ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
        `<p style="color:#444;font-size:15px;line-height:1.6;margin:0;">${shop.name}'s front-page feature ends on <strong>${endStr}</strong>. Renew now to stay at the top of the shop list without a gap.</p>`),
      `Heads up: ${shop.name}'s DonutDash feature ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Renew: donutdash.app/shop/promote`,
    )
    await svc.from('dd_shops').update({ sponsor_reminded_for: shop.sponsor_expires_at }).eq('id', shop.id)
    reminded++
  }

  return NextResponse.json({ expired: expired?.length ?? 0, reminded })
}
