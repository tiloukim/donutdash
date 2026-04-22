import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'

/**
 * POST — Create a Stripe Connect account for the authenticated shop owner
 *        and return the onboarding URL.
 * GET  — Check whether the shop's Stripe Connect account is fully onboarded.
 */

async function getShopOwnerContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const svc = createServiceClient()
  const { data: ddUser } = await svc
    .from('dd_users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()

  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) return null

  const { data: shop } = await svc
    .from('dd_shops')
    .select('id, name, stripe_account_id, stripe_onboarding_complete')
    .eq('owner_id', ddUser.id)
    .single()

  if (!shop) return null
  return { shop, svc }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getShopOwnerContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const stripe = getStripe()
    const { shop, svc } = ctx
    let accountId = shop.stripe_account_id

    // Create a new Connect account if one doesn't exist yet
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        metadata: { shop_id: shop.id },
      })
      accountId = account.id

      await svc
        .from('dd_shops')
        .update({ stripe_account_id: accountId })
        .eq('id', shop.id)
    }

    // Generate the onboarding link
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || 'https://donutdash.app'
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/api/stripe/connect/callback?refresh=1`,
      return_url: `${origin}/api/stripe/connect/callback`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (err) {
    console.error('Stripe Connect create error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create connect account' },
      { status: 500 },
    )
  }
}

export async function GET() {
  try {
    const ctx = await getShopOwnerContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { shop } = ctx

    if (!shop.stripe_account_id) {
      return NextResponse.json({ connected: false, onboarding_complete: false })
    }

    // Check live status from Stripe
    const stripe = getStripe()
    const account = await stripe.accounts.retrieve(shop.stripe_account_id)
    const onboardingComplete = account.charges_enabled && account.payouts_enabled

    // Sync to DB if status changed
    if (onboardingComplete && !shop.stripe_onboarding_complete) {
      const svc = createServiceClient()
      await svc
        .from('dd_shops')
        .update({ stripe_onboarding_complete: true })
        .eq('id', shop.id)
    }

    return NextResponse.json({
      connected: true,
      onboarding_complete: onboardingComplete,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
    })
  } catch (err) {
    console.error('Stripe Connect status error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to check connect status' },
      { status: 500 },
    )
  }
}
