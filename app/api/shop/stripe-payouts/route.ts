import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

// GET /api/shop/stripe-payouts
//
// Returns the shop's Stripe Connect account balance + recent payouts +
// linked bank info — so the shop owner can see "when's my next payout,
// to which bank, how much" without leaving DonutDash or logging into
// Stripe Express separately.
//
// All Stripe calls scope to the connected account via `stripeAccount:`,
// so the platform never sees other shops' data through this route.

export async function GET() {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).maybeSingle()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // The signed-in owner's first shop — same pattern /api/shop/earnings uses.
  const { data: shop } = await svc
    .from('dd_shops')
    .select('id, name, stripe_account_id')
    .eq('owner_id', ddUser.id)
    .single()
  if (!shop) return NextResponse.json({ error: 'No shop' }, { status: 404 })
  if (!shop.stripe_account_id) {
    return NextResponse.json({
      connected: false,
      message: 'Stripe is not connected for this shop. Finish Stripe onboarding from /shop/settings to start receiving payouts.',
    })
  }

  const stripe = getStripe()
  const connectedAccount = shop.stripe_account_id

  try {
    // Parallel Stripe calls scoped to the connected account
    const [account, balance, payouts] = await Promise.all([
      stripe.accounts.retrieve(connectedAccount),
      stripe.balance.retrieve({}, { stripeAccount: connectedAccount }),
      stripe.payouts.list({ limit: 10 }, { stripeAccount: connectedAccount }),
    ])

    const available = balance.available
      .filter(b => b.currency === 'usd')
      .reduce((s, b) => s + b.amount, 0) / 100
    const pending = balance.pending
      .filter(b => b.currency === 'usd')
      .reduce((s, b) => s + b.amount, 0) / 100

    // Find the default external account (bank) for USD payouts
    const defaultBank = account.external_accounts?.data.find(
      e => e.object === 'bank_account' && (e as { default_for_currency?: boolean }).default_for_currency,
    ) ?? account.external_accounts?.data[0]
    const bankInfo = defaultBank && defaultBank.object === 'bank_account' ? {
      bank_name: (defaultBank as { bank_name?: string }).bank_name ?? null,
      last4: (defaultBank as { last4?: string }).last4 ?? null,
      currency: (defaultBank as { currency?: string }).currency ?? null,
      status: (defaultBank as { status?: string }).status ?? null,
    } : null

    const schedule = account.settings?.payouts?.schedule ?? null

    return NextResponse.json({
      connected: true,
      shop: { id: shop.id, name: shop.name },
      stripe_account_id: connectedAccount,
      balance: {
        available_usd: +available.toFixed(2),
        pending_usd: +pending.toFixed(2),
        total_usd: +(available + pending).toFixed(2),
      },
      bank: bankInfo,
      payout_schedule: schedule,
      payouts_enabled: account.payouts_enabled,
      charges_enabled: account.charges_enabled,
      recent_payouts: payouts.data.map(p => ({
        id: p.id,
        amount_usd: +(p.amount / 100).toFixed(2),
        status: p.status,
        method: p.method,
        arrival_date: p.arrival_date ? new Date(p.arrival_date * 1000).toISOString() : null,
        created: new Date(p.created * 1000).toISOString(),
        description: p.description,
      })),
      express_login_url: 'https://connect.stripe.com/express_login',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Stripe fetch failed'
    return NextResponse.json({
      connected: true,
      error: msg,
      stripe_account_id: connectedAccount,
    }, { status: 502 })
  }
}
