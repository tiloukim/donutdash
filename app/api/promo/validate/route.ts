import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'

// Promotions disabled platform-wide. All codes return invalid until promo
// application is rewired through Stripe coupons. The Stripe checkout route
// does not currently apply discounts to line_items, so any active promo would
// overcharge the customer and overpay the shop. Re-enable once that is fixed.
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const { allowed } = await checkRateLimit(`promo:${ip}`, 20, 60000)
    if (!allowed) {
      return NextResponse.json({ valid: false, error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    return NextResponse.json(
      { valid: false, error: 'Promo codes are temporarily unavailable' },
      { status: 404 },
    )
  } catch {
    return NextResponse.json({ valid: false, error: 'Something went wrong' }, { status: 500 })
  }
}
