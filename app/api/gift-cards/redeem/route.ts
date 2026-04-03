import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const svc = createServiceClient()
    const { data: ddUser } = await svc
      .from('dd_users')
      .select('id, credit_balance')
      .eq('auth_id', authUser.id)
      .single()

    if (!ddUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { code } = await request.json()
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Gift card code is required' }, { status: 400 })
    }

    const normalizedCode = code.trim().toUpperCase()

    const { data: card } = await svc
      .from('dd_gift_cards')
      .select('*')
      .eq('code', normalizedCode)
      .single()

    if (!card) {
      return NextResponse.json({ error: 'Gift card not found' }, { status: 404 })
    }

    if (card.status !== 'active') {
      return NextResponse.json({ error: 'This gift card has already been redeemed or expired' }, { status: 400 })
    }

    if (card.balance <= 0) {
      return NextResponse.json({ error: 'This gift card has no remaining balance' }, { status: 400 })
    }

    // Update gift card status
    const { error: cardError } = await svc
      .from('dd_gift_cards')
      .update({
        status: 'redeemed',
        redeemed_by: ddUser.id,
        redeemed_at: new Date().toISOString(),
        balance: 0,
      })
      .eq('id', card.id)

    if (cardError) {
      return NextResponse.json({ error: cardError.message }, { status: 500 })
    }

    // Add balance to user's credit
    const newBalance = Number(ddUser.credit_balance || 0) + Number(card.balance)
    const { error: userError } = await svc
      .from('dd_users')
      .update({ credit_balance: newBalance })
      .eq('id', ddUser.id)

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 })
    }

    return NextResponse.json({
      message: `Gift card redeemed! $${card.balance.toFixed(2)} added to your account.`,
      credited: card.balance,
      new_balance: newBalance,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
