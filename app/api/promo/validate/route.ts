import { NextRequest, NextResponse } from 'next/server'

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

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json()

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ valid: false, error: 'Please enter a promo code' }, { status: 400 })
    }

    const promo = PROMO_CODES.find(p => p.code === code.trim().toUpperCase())

    if (!promo) {
      return NextResponse.json({ valid: false, error: 'Invalid promo code' }, { status: 404 })
    }

    return NextResponse.json({
      valid: true,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      description: promo.description,
      min_order: promo.min_order,
      max_discount: promo.max_discount || null,
    })
  } catch {
    return NextResponse.json({ valid: false, error: 'Something went wrong' }, { status: 500 })
  }
}
