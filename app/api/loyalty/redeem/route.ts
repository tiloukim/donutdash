import { NextResponse } from 'next/server'

// Reward redemption disabled while promo application is being rewired through
// Stripe coupons. The previous flow burned loyalty points for a REWARD-XXXX
// code, but the Stripe checkout route does not actually apply discounts to
// line_items, so customers were overcharged and shops over-paid. Points still
// accrue on completed orders; redemption returns when promos do.
export async function POST() {
  return NextResponse.json(
    { error: 'Rewards redemption is temporarily unavailable' },
    { status: 503 },
  )
}
