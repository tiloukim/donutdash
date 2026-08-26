import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const revalidate = 120 // public, non-personalized display info

// Public, NON-sensitive view of the current welcome offer so the landing page
// can advertise exactly what checkout will honor (never a hard-coded promo).
// The real discount is still computed + gated server-side at charge time.
export async function GET() {
  try {
    const svc = createServiceClient()
    const { data } = await svc
      .from('dd_platform_settings')
      .select('key, value')
      .like('key', 'welcome_promo%')
    const m = new Map((data || []).map(r => [r.key, r.value]))
    const enabled = m.get('welcome_promo_enabled') === 'true'
    const type = m.get('welcome_promo_type') === 'amount' ? 'amount' : 'percent'
    const value = Number(m.get('welcome_promo_value') || 0)
    const code = m.get('welcome_promo_code') || null
    const freeDelivery = m.get('welcome_promo_free_delivery') === 'true'
    // Nothing to advertise unless there's a discount or free delivery.
    if (!enabled || (value <= 0 && !freeDelivery)) return NextResponse.json({ enabled: false })
    const discountLabel = value > 0 ? (type === 'percent' ? `${value}% OFF` : `$${value} OFF`) : ''
    const label = [freeDelivery ? 'FREE Delivery' : '', discountLabel].filter(Boolean).join(' + ')
    return NextResponse.json({
      enabled: true,
      type,
      value,
      code,
      freeDelivery,
      label,
    })
  } catch {
    return NextResponse.json({ enabled: false })
  }
}
