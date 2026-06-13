import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canAccessAdminPortal } from '@/lib/admin-auth'
import { buildPitchForShopId, buildPitchEmailHtml } from '@/lib/pitch'
import { sendEmail } from '@/lib/sms'

// POST /api/admin/pitch-campaign/:id/send
// Manual one-off send from the admin UI's "Send now" button. Same
// email body + unsubscribe link as the weekly cron, just on-demand
// and only for a single recipient. Updates last_sent_at + send_count
// so the cron's 7-day cooldown carries over.

const ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || 'https://donutdash.app'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: caller } = await svc
    .from('dd_users')
    .select('role')
    .eq('auth_id', user.id)
    .single()
  if (!caller || (!canAccessAdminPortal(caller.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { data: recipient } = await svc
    .from('dd_pitch_campaign_recipients')
    .select('id, shop_id, recipient_email, unsubscribe_token, send_count, unsubscribed_at')
    .eq('id', id)
    .maybeSingle()
  if (!recipient) {
    return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })
  }
  if (recipient.unsubscribed_at) {
    return NextResponse.json({ error: 'Recipient has unsubscribed' }, { status: 400 })
  }

  const pitch = await buildPitchForShopId(recipient.shop_id)
  if (!pitch) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

  const unsubscribeUrl = `${ORIGIN}/unsubscribe/${recipient.unsubscribe_token}`
  const html = buildPitchEmailHtml(pitch, unsubscribeUrl)
  const subject = pitch.annual_revenue_lost_dollars > 0
    ? `${pitch.shop.name}: you're losing ~$${pitch.annual_revenue_lost_dollars.toLocaleString()}/yr to competitors`
    : `${pitch.shop.name}: customers are searching for you on DonutDash`

  const ok = await sendEmail(recipient.recipient_email, subject, html)
  if (!ok) return NextResponse.json({ error: 'Email send failed' }, { status: 500 })

  await svc
    .from('dd_pitch_campaign_recipients')
    .update({
      last_sent_at: new Date().toISOString(),
      send_count: (recipient.send_count ?? 0) + 1,
    })
    .eq('id', id)

  return NextResponse.json({ sent: true })
}
