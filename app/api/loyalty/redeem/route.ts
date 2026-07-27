import { NextResponse } from 'next/server'

// Reward redemption disabled while promo application is being rewired. The
// previous flow burned loyalty points for a REWARD-XXXX code, but the checkout
// route did not actually apply the discount to line items, so customers were
// overcharged and shops over-paid. Points still accrue on completed orders;
// redemption returns when promos do.
export async function POST() {
  return NextResponse.json(
    { error: 'Rewards redemption is temporarily unavailable' },
    { status: 503 },
  )
}
