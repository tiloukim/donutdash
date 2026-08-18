import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerShop as getActiveShop } from '@/lib/shop-auth'
import crypto from 'crypto'

function generateShopReferralCode(): string {
  return 'SHOP' + crypto.randomBytes(3).toString('hex').toUpperCase()
}

// GET — get shop's referral code and stats
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const shop = await getActiveShop(svc, ddUser.id)
  if (!shop) return NextResponse.json({ error: 'No shop found' }, { status: 404 })

  // Auto-generate referral code if none
  let referralCode = shop.referral_code
  if (!referralCode) {
    referralCode = generateShopReferralCode()
    await svc.from('dd_shops').update({ referral_code: referralCode }).eq('id', shop.id)
  }

  // Get referral stats with referred shop name
  const { data: referrals } = await svc.from('dd_shop_referrals')
    .select('id, status, orders_completed, orders_required, referee_shop_id, created_at, completed_at, referee_shop:dd_shops!referee_shop_id(name)')
    .eq('referrer_shop_id', shop.id)
    .order('created_at', { ascending: false })

  const completed = (referrals || []).filter(r => r.status === 'completed').length
  const totalEarned = completed * 100

  // Also check if this shop was referred by someone (as referee)
  const { data: myReferral } = await svc.from('dd_shop_referrals')
    .select('id, status, orders_completed, orders_required, referrer_credit, referee_credit, created_at, completed_at')
    .eq('referee_shop_id', shop.id)
    .maybeSingle()

  return NextResponse.json({
    referral_code: referralCode,
    referrals: referrals || [],
    completed_count: completed,
    total_earned: totalEarned,
    my_referral: myReferral || null,
  })
}

// POST — new shop applies a shop referral code during setup
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { referral_code } = await req.json()
  if (!referral_code) return NextResponse.json({ error: 'Missing referral code' }, { status: 400 })

  const code = referral_code.toUpperCase()

  // Check if already referred
  const { data: existing } = await svc.from('dd_shop_referrals')
    .select('id')
    .eq('referee_user_id', ddUser.id)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'You have already used a referral code' }, { status: 400 })
  }

  // Get the new shop
  const newShop = await getActiveShop(svc, ddUser.id)

  // Referral codes are signup-time only. Once the shop has any orders,
  // signup is "complete" and codes can no longer be applied retroactively.
  if (newShop?.id) {
    const { count: orderCount } = await svc.from('dd_orders')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', newShop.id)
    if ((orderCount || 0) > 0) {
      return NextResponse.json({ error: 'Referral codes can only be applied during signup' }, { status: 400 })
    }
  }

  // Check if it's a driver referral code (DRV prefix) or shop referral code (SHOP prefix)
  const { data: referrerByUserCode } = await svc.from('dd_users')
    .select('id, role')
    .eq('referral_code', code)
    .maybeSingle()

  const { data: referrerShop } = await svc.from('dd_shops')
    .select('id, owner_id')
    .eq('referral_code', code)
    .maybeSingle()

  if (!referrerByUserCode && !referrerShop) {
    return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 })
  }

  // Determine referrer info
  let referrerUserId: string
  let referrerShopId: string | null = null

  if (referrerShop) {
    // Shop-to-shop referral
    if (referrerShop.owner_id === ddUser.id) {
      return NextResponse.json({ error: 'Cannot use your own referral code' }, { status: 400 })
    }
    referrerUserId = referrerShop.owner_id
    referrerShopId = referrerShop.id
  } else {
    // Driver-to-shop referral
    referrerUserId = referrerByUserCode!.id
    if (referrerUserId === ddUser.id) {
      return NextResponse.json({ error: 'Cannot use your own referral code' }, { status: 400 })
    }
  }

  // Create pending referral
  await svc.from('dd_shop_referrals').insert({
    referrer_shop_id: referrerShopId,
    referrer_user_id: referrerUserId,
    referee_shop_id: newShop?.id || null,
    referee_user_id: ddUser.id,
    status: 'pending',
    orders_required: 20,
    orders_completed: 0,
  })

  return NextResponse.json({ success: true, message: 'Shop referral applied! Both shops will receive $100 credit after 20 completed orders.' })
}
