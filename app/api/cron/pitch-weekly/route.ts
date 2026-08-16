import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { buildPitchForShopId, buildPitchEmailHtml } from '@/lib/pitch'
import { sendEmail, notifyAdmins } from '@/lib/sms'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Vercel cron — Monday 7 AM CT (12 UTC), once a week.
// Wired in vercel.json: { "path": "/api/cron/pitch-weekly", "schedule": "0 12 * * 1" }
//
// Walks every active recipient on dd_pitch_campaign_recipients whose
// last_sent_at is older than 7 days (or null), is NOT unsubscribed,
// and whose target shop is still unclaimed. Sends each a fresh
// pitch email via Resend with the recipient-specific unsubscribe
// link. CAN-SPAM compliant: identifiable sender, physical address,
// working unsubscribe.
//
// SMS is intentionally NOT auto-blasted from here — TCPA opt-in nuance
// makes cold B2B SMS dangerous to automate. Admins send SMS one-by-one
// through the /admin/shops/:id/pitch page after a manual consent
// step.

const ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || 'https://donutdash.app'

export async function GET(req: NextRequest) {
  // Same cron-secret guard as the other Vercel crons.
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  // Fail closed: reject when the secret is unset rather than running publicly.
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Pull every eligible recipient. Two-step filter (DB + JS) so the
  // logic stays obvious — at our outreach volume this is a tiny query.
  const { data: recipients, error } = await svc
    .from('dd_pitch_campaign_recipients')
    .select('id, shop_id, recipient_email, recipient_name, unsubscribe_token, last_sent_at, send_count')
    .eq('status', 'active')
    .is('unsubscribed_at', null)
    .or(`last_sent_at.is.null,last_sent_at.lt.${sevenDaysAgo}`)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results: Array<{ id: string; email: string; status: 'sent' | 'skipped' | 'failed'; reason?: string }> = []

  for (const r of recipients ?? []) {
    const pitch = await buildPitchForShopId(r.shop_id)
    if (!pitch) {
      results.push({ id: r.id, email: r.recipient_email, status: 'skipped', reason: 'shop_not_found' })
      continue
    }
    // Skip claimed shops — pitching someone whose shop is already on
    // the platform is awkward and wastes credibility.
    if (pitch.shop.is_claimed) {
      results.push({ id: r.id, email: r.recipient_email, status: 'skipped', reason: 'shop_already_claimed' })
      continue
    }

    const unsubscribeUrl = `${ORIGIN}/unsubscribe/${r.unsubscribe_token}`
    const html = buildPitchEmailHtml(pitch, unsubscribeUrl)
    const subject = pitch.annual_revenue_lost_dollars > 0
      ? `${pitch.shop.name}: you're losing ~$${pitch.annual_revenue_lost_dollars.toLocaleString()}/yr to competitors`
      : `${pitch.shop.name}: customers are searching for you on DonutDash`

    const ok = await sendEmail(r.recipient_email, subject, html)
    if (ok) {
      await svc
        .from('dd_pitch_campaign_recipients')
        .update({
          last_sent_at: new Date().toISOString(),
          send_count: (r.send_count ?? 0) + 1,
        })
        .eq('id', r.id)
      results.push({ id: r.id, email: r.recipient_email, status: 'sent' })
    } else {
      results.push({ id: r.id, email: r.recipient_email, status: 'failed', reason: 'sendEmail_returned_false' })
    }
  }

  const sentCount = results.filter((r) => r.status === 'sent').length
  const failedCount = results.filter((r) => r.status === 'failed').length

  // Surface the run summary to admins — silent crons that send 50
  // emails to the wrong list are scarier than a chatty one.
  if (sentCount > 0 || failedCount > 0) {
    notifyAdmins(
      `Pitch cron: ${sentCount} sent, ${failedCount} failed, ${results.length} total processed.`,
      'DonutDash pitch cron summary',
    ).catch(() => {})
  }

  return NextResponse.json({
    processed: results.length,
    sent: sentCount,
    failed: failedCount,
    skipped: results.filter((r) => r.status === 'skipped').length,
    results,
  })
}
