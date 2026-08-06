import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/sms'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || ddUser.role !== 'admin') {
    return { error: 'Forbidden', status: 403 as const }
  }
  return { ddUser, svc }
}

// GET — list claim requests (defaults to pending). Pass ?status=all|pending|approved|denied
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { svc } = auth

  const statusFilter = new URL(req.url).searchParams.get('status') || 'pending'

  let query = svc
    .from('dd_shop_claim_requests')
    .select(
      '*, shop:dd_shops!shop_id(id, name, slug, address, city, state, zip, phone, image_url, is_claimed, owner_id), requester:dd_users!requester_id(id, name, email, phone, role)'
    )
    .order('created_at', { ascending: false })

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ requests: data || [] })
}

// POST — approve or deny a claim request
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { ddUser, svc } = auth

  let body: { request_id?: string; action?: string; admin_notes?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { request_id, action, admin_notes } = body
  if (!request_id || !action || !['approve', 'deny'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Load the claim request with shop & requester info
  const { data: claim, error: claimErr } = await svc
    .from('dd_shop_claim_requests')
    .select(
      '*, shop:dd_shops!shop_id(id, name, slug, owner_id, is_claimed), requester:dd_users!requester_id(id, name, email)'
    )
    .eq('id', request_id)
    .single()

  if (claimErr || !claim) {
    return NextResponse.json({ error: 'Claim request not found' }, { status: 404 })
  }

  if (claim.status !== 'pending') {
    return NextResponse.json({ error: `Claim request already ${claim.status}` }, { status: 409 })
  }

  const now = new Date().toISOString()

  if (action === 'approve') {
    // Verify shop still unclaimed
    if (claim.shop?.owner_id || claim.shop?.is_claimed === true) {
      return NextResponse.json(
        { error: 'Shop has already been claimed by someone else.' },
        { status: 409 }
      )
    }

    // Assign ownership
    const { error: shopErr } = await svc
      .from('dd_shops')
      .update({
        owner_id: claim.requester_id,
        is_claimed: true,
        claimed_at: now,
      })
      .eq('id', claim.shop_id)
      .is('owner_id', null)

    if (shopErr) {
      return NextResponse.json({ error: shopErr.message }, { status: 500 })
    }

    // Upgrade requester to shop_owner if still customer
    if (claim.requester?.id) {
      await svc
        .from('dd_users')
        .update({ role: 'shop_owner' })
        .eq('id', claim.requester.id)
        .eq('role', 'customer')
    }

    // Update claim request
    const { error: updErr } = await svc
      .from('dd_shop_claim_requests')
      .update({
        status: 'approved',
        admin_notes: admin_notes || null,
        reviewed_by: ddUser.id,
        reviewed_at: now,
      })
      .eq('id', request_id)

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    // Email requester
    if (claim.requester?.email) {
      const html = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;">
          <div style="background:#FF1493;padding:20px;text-align:center;border-radius:12px 12px 0 0;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;">DonutDash&trade;</h1>
          </div>
          <div style="padding:24px 20px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;">
            <h2 style="margin:0 0 12px 0;color:#222;font-size:18px;">Your claim has been approved!</h2>
            <p style="margin:0 0 12px 0;font-size:14px;color:#444;line-height:1.6;">
              Great news — you are now the verified owner of <strong>${claim.shop?.name}</strong> on DonutDash.
              You can now set up your menu, hours, and payouts.
            </p>
            ${admin_notes ? `<p style="font-size:13px;color:#666;line-height:1.6;"><strong>Note from admin:</strong> ${admin_notes}</p>` : ''}
            <a href="https://donutdash.app/shop" style="display:inline-block;margin-top:12px;padding:12px 24px;background:#FF1493;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">Open shop dashboard</a>
          </div>
        </div>
      `
      await sendEmail(claim.requester.email, `Your DonutDash shop claim has been approved`, html)
    }

    return NextResponse.json({ ok: true, status: 'approved' })
  }

  // Deny
  const { error: denyErr } = await svc
    .from('dd_shop_claim_requests')
    .update({
      status: 'denied',
      admin_notes: admin_notes || null,
      reviewed_by: ddUser.id,
      reviewed_at: now,
    })
    .eq('id', request_id)

  if (denyErr) {
    return NextResponse.json({ error: denyErr.message }, { status: 500 })
  }

  // Email requester
  if (claim.requester?.email) {
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;">
        <div style="background:#FF1493;padding:20px;text-align:center;border-radius:12px 12px 0 0;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;">DonutDash&trade;</h1>
        </div>
        <div style="padding:24px 20px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;">
          <h2 style="margin:0 0 12px 0;color:#222;font-size:18px;">Your claim request was not approved</h2>
          <p style="margin:0 0 12px 0;font-size:14px;color:#444;line-height:1.6;">
            We reviewed your claim request for <strong>${claim.shop?.name}</strong> and were unable to
            approve it at this time.
          </p>
          ${admin_notes ? `<p style="font-size:13px;color:#666;line-height:1.6;background:#F9FAFB;padding:10px 12px;border-radius:8px;"><strong>Reason:</strong> ${admin_notes}</p>` : ''}
          <p style="margin:12px 0 0;font-size:13px;color:#666;line-height:1.6;">
            If you believe this was a mistake or want to resubmit with additional documents,
            reply to this email or contact support.
          </p>
        </div>
      </div>
    `
    await sendEmail(claim.requester.email, `Update on your DonutDash shop claim`, html)
  }

  return NextResponse.json({ ok: true, status: 'denied' })
}
