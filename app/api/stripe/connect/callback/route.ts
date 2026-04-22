import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'

/**
 * GET — Return URL after Stripe onboarding.
 * Checks account status and updates the shop record, then redirects
 * to the shop settings page.
 */
export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || 'https://donutdash.app'
  const settingsUrl = `${origin}/shop/settings`

  try {
    const refresh = request.nextUrl.searchParams.get('refresh')

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.redirect(`${origin}/login`)
    }

    const svc = createServiceClient()
    const { data: ddUser } = await svc
      .from('dd_users')
      .select('id, role')
      .eq('auth_id', user.id)
      .single()

    if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) {
      return NextResponse.redirect(settingsUrl)
    }

    const { data: shop } = await svc
      .from('dd_shops')
      .select('id, stripe_account_id')
      .eq('owner_id', ddUser.id)
      .single()

    if (!shop?.stripe_account_id) {
      return NextResponse.redirect(settingsUrl)
    }

    // If this is a refresh redirect (user left onboarding early), just redirect back
    if (refresh) {
      return NextResponse.redirect(settingsUrl)
    }

    // Check the account status from Stripe
    const stripe = getStripe()
    const account = await stripe.accounts.retrieve(shop.stripe_account_id)
    const onboardingComplete = account.charges_enabled && account.payouts_enabled

    await svc
      .from('dd_shops')
      .update({ stripe_onboarding_complete: onboardingComplete })
      .eq('id', shop.id)

    return NextResponse.redirect(settingsUrl)
  } catch (err) {
    console.error('Stripe Connect callback error:', err)
    return NextResponse.redirect(settingsUrl)
  }
}
