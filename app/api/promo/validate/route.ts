import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

interface PromoCode {
  code: string
  discount_type: 'percent' | 'fixed' | 'free_delivery'
  discount_value: number
  description: string
  min_order: number
  max_discount?: number
}

const PROMO_CODES: PromoCode[] = [
  {
    code: 'WELCOME10',
    discount_type: 'percent',
    discount_value: 10,
    description: '10% off your subtotal (up to $5)',
    min_order: 0,
    max_discount: 5,
  },
  {
    code: 'FREEDELIVERY',
    discount_type: 'free_delivery',
    discount_value: 0,
    description: 'Free delivery on your order',
    min_order: 0,
  },
  {
    code: 'DONUT5',
    discount_type: 'fixed',
    discount_value: 5,
    description: '$5 off orders over $20',
    min_order: 20,
  },
]

// Reward type mapping for loyalty-redeemed promo codes
const REWARD_PROMO_MAP: Record<string, { discount_type: 'fixed' | 'free_delivery'; discount_value: number; description: string }> = {
  free_delivery: { discount_type: 'free_delivery', discount_value: 0, description: 'Free Delivery (Loyalty Reward)' },
  discount_5: { discount_type: 'fixed', discount_value: 5, description: '$5 Off (Loyalty Reward)' },
  discount_10: { discount_type: 'fixed', discount_value: 10, description: '$10 Off (Loyalty Reward)' },
}

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json()

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ valid: false, error: 'Please enter a promo code' }, { status: 400 })
    }

    const normalizedCode = code.trim().toUpperCase()

    // Check hardcoded promo codes first
    const promo = PROMO_CODES.find(p => p.code === normalizedCode)

    if (promo) {
      return NextResponse.json({
        valid: true,
        discount_type: promo.discount_type,
        discount_value: promo.discount_value,
        description: promo.description,
        min_order: promo.min_order,
        max_discount: promo.max_discount || null,
      })
    }

    // Check loyalty-redeemed promo codes (REWARD-XXXXXXXX format)
    if (normalizedCode.startsWith('REWARD-')) {
      const svc = createServiceClient()
      const { data: transaction } = await svc
        .from('dd_loyalty_transactions')
        .select('description, type')
        .eq('type', 'redeemed')
        .like('description', `%${normalizedCode}%`)
        .maybeSingle()

      if (transaction) {
        // Parse the reward type from description (e.g. "Redeemed: Free Delivery (REWARD-XXXX)")
        const desc = transaction.description || ''
        let rewardInfo = REWARD_PROMO_MAP['discount_5'] // fallback
        if (desc.includes('Free Delivery')) {
          rewardInfo = REWARD_PROMO_MAP['free_delivery']
        } else if (desc.includes('$10')) {
          rewardInfo = REWARD_PROMO_MAP['discount_10']
        } else if (desc.includes('$5')) {
          rewardInfo = REWARD_PROMO_MAP['discount_5']
        }

        return NextResponse.json({
          valid: true,
          discount_type: rewardInfo.discount_type,
          discount_value: rewardInfo.discount_value,
          description: rewardInfo.description,
          min_order: 0,
          max_discount: null,
        })
      }
    }

    return NextResponse.json({ valid: false, error: 'Invalid promo code' }, { status: 404 })
  } catch {
    return NextResponse.json({ valid: false, error: 'Something went wrong' }, { status: 500 })
  }
}
