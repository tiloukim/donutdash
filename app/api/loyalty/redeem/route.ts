import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import crypto from 'crypto'

const REWARDS: Record<string, { cost: number; description: string; promoType: string; promoValue: number }> = {
  free_delivery: {
    cost: 200,
    description: 'Free Delivery',
    promoType: 'free_delivery',
    promoValue: 0,
  },
  discount_5: {
    cost: 300,
    description: '$5 Off Your Order',
    promoType: 'fixed',
    promoValue: 5,
  },
  discount_10: {
    cost: 500,
    description: '$10 Off Your Order',
    promoType: 'fixed',
    promoValue: 10,
  },
}

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
      .select('id')
      .eq('auth_id', authUser.id)
      .single()

    if (!ddUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { type } = await request.json()
    const reward = REWARDS[type]

    if (!reward) {
      return NextResponse.json({ error: 'Invalid reward type' }, { status: 400 })
    }

    // Get current loyalty
    const { data: loyalty } = await svc
      .from('dd_loyalty')
      .select('points')
      .eq('user_id', ddUser.id)
      .single()

    if (!loyalty || loyalty.points < reward.cost) {
      return NextResponse.json({
        error: `Not enough points. Need ${reward.cost}, have ${loyalty?.points || 0}`,
      }, { status: 400 })
    }

    // Generate promo code
    const promoCode = `REWARD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`

    // Deduct points
    await svc
      .from('dd_loyalty')
      .update({
        points: loyalty.points - reward.cost,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', ddUser.id)

    // Log transaction
    await svc
      .from('dd_loyalty_transactions')
      .insert({
        user_id: ddUser.id,
        points: -reward.cost,
        type: 'redeemed',
        description: `Redeemed: ${reward.description} (${promoCode})`,
      })

    return NextResponse.json({
      promo_code: promoCode,
      description: reward.description,
      promo_type: reward.promoType,
      promo_value: reward.promoValue,
      points_spent: reward.cost,
      remaining_points: loyalty.points - reward.cost,
    })
  } catch (err) {
    console.error('Loyalty redeem error:', err)
    return NextResponse.json({ error: 'Failed to redeem reward' }, { status: 500 })
  }
}
