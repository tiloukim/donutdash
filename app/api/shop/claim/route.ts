import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { notifyAdmins } from '@/lib/sms'

export async function POST(req: Request) {
  const supabase = await createClient()
  const svc = createServiceClient()

  // Authenticate the user (mirrors /api/shop/setup)
  let authId: string | null = null
  const { data: { user } } = await supabase.auth.getUser()
  if (user) authId = user.id

  if (!authId) {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) authId = session.user.id
  }

  if (!authId) {
    return NextResponse.json(
      { error: 'Unauthorized - please sign in' },
      { status: 401 }
    )
  }

  // Parse body
  let body: {
    shop_id?: string
    relationship?: string
    phone?: string
    business_license_url?: string
    utility_bill_url?: string
    health_permit_url?: string
    additional_docs_url?: string
    notes?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const {
    shop_id: shopId,
    relationship,
    phone,
    business_license_url,
    utility_bill_url,
    health_permit_url,
    additional_docs_url,
    notes,
  } = body

  if (!shopId) {
    return NextResponse.json({ error: 'Missing shop_id' }, { status: 400 })
  }
  if (!relationship || !['owner', 'manager', 'employee'].includes(relationship)) {
    return NextResponse.json({ error: 'Please select your relationship to the shop' }, { status: 400 })
  }

  // Resolve or create the dd_user row for this auth_id
  let ddUser = (
    await svc.from('dd_users').select('*').eq('auth_id', authId).single()
  ).data

  if (!ddUser) {
    const { data: { user: authUser } } = await svc.auth.admin.getUserById(authId)
    if (authUser) {
      const meta = authUser.user_metadata || {}
      const { data: newUser, error: insertErr } = await svc
        .from('dd_users')
        .insert({
          auth_id: authId,
          email: authUser.email!,
          name: meta.name || authUser.email!.split('@')[0],
          phone: meta.phone || null,
          role: meta.role || 'shop_owner',
        })
        .select()
        .single()

      if (insertErr) {
        // Email conflict — link existing row
        await svc
          .from('dd_users')
          .update({ auth_id: authId })
          .eq('email', authUser.email!)
        ddUser = (
          await svc.from('dd_users').select('*').eq('auth_id', authId).single()
        ).data
      } else {
        ddUser = newUser
      }
    }
  }

  if (!ddUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Load the target shop and verify it's unclaimed
  const { data: shop, error: shopErr } = await svc
    .from('dd_shops')
    .select('*')
    .eq('id', shopId)
    .maybeSingle()

  if (shopErr) {
    return NextResponse.json({ error: shopErr.message }, { status: 500 })
  }
  if (!shop) {
    return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
  }
  if (shop.owner_id || shop.is_claimed === true) {
    return NextResponse.json(
      { error: 'This shop has already been claimed.' },
      { status: 409 }
    )
  }

  // Check no existing pending request from this user for this shop
  const { data: existingRequest } = await svc
    .from('dd_shop_claim_requests')
    .select('id, status')
    .eq('shop_id', shopId)
    .eq('requester_id', ddUser.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (existingRequest) {
    return NextResponse.json(
      { error: 'You already have a pending claim request for this shop.' },
      { status: 409 }
    )
  }

  // Update phone on user row if not set yet
  if (phone && !ddUser.phone) {
    await svc.from('dd_users').update({ phone }).eq('id', ddUser.id)
  }

  // Insert claim request
  const { data: claimRequest, error: insertErr } = await svc
    .from('dd_shop_claim_requests')
    .insert({
      shop_id: shopId,
      requester_id: ddUser.id,
      requester_name: ddUser.name,
      requester_email: ddUser.email,
      requester_phone: phone || ddUser.phone || null,
      relationship,
      business_license_url: business_license_url || null,
      utility_bill_url: utility_bill_url || null,
      health_permit_url: health_permit_url || null,
      additional_docs_url: additional_docs_url || null,
      notes: notes || null,
      status: 'pending',
    })
    .select()
    .single()

  if (insertErr || !claimRequest) {
    return NextResponse.json(
      { error: insertErr?.message || 'Could not submit claim request.' },
      { status: 500 }
    )
  }

  // Notify admins
  try {
    const reviewUrl = `https://donutdash.app/admin/claim-requests`
    const smsMsg = `DonutDash: New shop claim request for "${shop.name}" by ${ddUser.name} (${ddUser.email}). Review: ${reviewUrl}`
    const emailHtml = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;">
        <div style="background:#FF1493;padding:20px;text-align:center;border-radius:12px 12px 0 0;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;">DonutDash Admin</h1>
        </div>
        <div style="padding:24px 20px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;">
          <h2 style="margin:0 0 12px 0;color:#222;font-size:18px;">New shop claim request</h2>
          <p style="margin:0 0 8px 0;font-size:14px;color:#444;"><strong>Shop:</strong> ${shop.name}</p>
          <p style="margin:0 0 8px 0;font-size:14px;color:#444;"><strong>Requester:</strong> ${ddUser.name} (${ddUser.email})</p>
          <p style="margin:0 0 8px 0;font-size:14px;color:#444;"><strong>Phone:</strong> ${phone || ddUser.phone || 'N/A'}</p>
          <p style="margin:0 0 16px 0;font-size:14px;color:#444;"><strong>Relationship:</strong> ${relationship}</p>
          <a href="${reviewUrl}" style="display:inline-block;padding:12px 24px;background:#FF1493;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">Review claim request</a>
        </div>
      </div>
    `
    await notifyAdmins(smsMsg, `New shop claim request: ${shop.name}`, emailHtml)
  } catch (err) {
    console.error('Admin notification error:', err)
  }

  return NextResponse.json({
    ok: true,
    message: "Claim request submitted. We'll review within 24-48 hours.",
    request_id: claimRequest.id,
  })
}
