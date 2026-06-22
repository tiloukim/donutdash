import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { computeWelcomePromo } from '@/lib/promo'

/**
 * POST — Validate a promo for the signed-in customer against their cart.
 *
 * Body: { subtotal: number, code?: string }
 * Returns { valid, discount, label, code } | { valid: false, error }.
 *
 * This endpoint is for DISPLAY ONLY — the discount the customer actually
 * receives is recomputed by each checkout route at charge time, so a tampered
 * response here can't change what they pay.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      return NextResponse.json({ valid: false, error: 'Please sign in to use a promo.' }, { status: 401 })
    }

    const { data: ddUser } = await supabase
      .from('dd_users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single()
    if (!ddUser) {
      return NextResponse.json({ valid: false, error: 'User not found' }, { status: 404 })
    }

    const { allowed } = await checkRateLimit(`promo:${ddUser.id}`, 20, 60000)
    if (!allowed) {
      return NextResponse.json({ valid: false, error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const body = await request.json().catch(() => ({}))
    const subtotal = Number(body?.subtotal) || 0
    const code: string | null = typeof body?.code === 'string' ? body.code : null

    const svc = createServiceClient()
    const promo = await computeWelcomePromo({ svc, customerId: ddUser.id, subtotal, code })

    if (!promo) {
      // A typed code that didn't resolve to a promo gets a clear message;
      // an empty-code probe (auto-apply check) just returns not-valid quietly.
      return NextResponse.json({
        valid: false,
        error: code ? 'That code isn’t valid for this order.' : null,
      })
    }

    return NextResponse.json({
      valid: true,
      discount: promo.discount,
      label: promo.label,
      code: promo.code,
    })
  } catch {
    return NextResponse.json({ valid: false, error: 'Something went wrong' }, { status: 500 })
  }
}
