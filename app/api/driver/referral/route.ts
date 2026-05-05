import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import crypto from 'crypto'

function generateDriverReferralCode(): string {
  return 'DRV' + crypto.randomBytes(3).toString('hex').toUpperCase()
}

// GET — get driver's referral code and stats (both shop + driver referrals)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role, referral_code').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'driver' && ddUser.role !== 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Auto-generate referral code if none
  let referralCode = ddUser.referral_code
  if (!referralCode) {
    referralCode = generateDriverReferralCode()
    await svc.from('dd_users').update({ referral_code: referralCode }).eq('id', ddUser.id)
  }

  // Get shop referrals (driver → shop)
  const { data: shopReferrals } = await svc.from('dd_shop_referrals')
    .select('id, status, orders_completed, orders_required, referrer_credit, created_at, completed_at, shop:dd_shops!referee_shop_id(name)')
    .eq('referrer_user_id', ddUser.id)
    .order('created_at', { ascending: false })

  const shopCompleted = (shopReferrals || []).filter(r => r.status === 'completed').length
  const shopEarned = shopCompleted * 100

  // Get driver referrals (driver → driver) from dd_referrals
  const { data: driverReferrals } = await svc.from('dd_referrals')
    .select('id, status, referrer_credit, created_at, completed_at, referee:dd_users!referee_id(name)')
    .eq('referrer_id', ddUser.id)
    .order('created_at', { ascending: false })

  const driverCompleted = (driverReferrals || []).filter(r => r.status === 'completed').length
  // Sum each completed referral's actual stored credit so historical $20 referrals
  // keep their amount; new ones at $50 add up correctly without retroactively bumping
  // anyone's earnings.
  const driverEarned = (driverReferrals || [])
    .filter(r => r.status === 'completed')
    .reduce((sum, r) => sum + Number(r.referrer_credit || 0), 0)

  return NextResponse.json({
    referral_code: referralCode,
    shop_referrals: shopReferrals || [],
    shop_completed: shopCompleted,
    shop_earned: shopEarned,
    driver_referrals: driverReferrals || [],
    driver_completed: driverCompleted,
    driver_earned: driverEarned,
    total_earned: shopEarned + driverEarned,
  })
}

// POST — driver applies another driver's referral code
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role, referred_by').eq('auth_id', user.id).single()
  if (!ddUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { referral_code } = await req.json()
  if (!referral_code) return NextResponse.json({ error: 'Missing referral code' }, { status: 400 })

  if (ddUser.referred_by) {
    return NextResponse.json({ error: 'You have already used a referral code' }, { status: 400 })
  }

  // Find referrer driver by code
  const { data: referrer } = await svc.from('dd_users')
    .select('id, role')
    .eq('referral_code', referral_code.toUpperCase())
    .maybeSingle()

  if (!referrer) return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 })
  if (referrer.id === ddUser.id) return NextResponse.json({ error: 'Cannot use your own code' }, { status: 400 })

  const CREDIT = 50.00

  // Create pending referral — completed after first delivery
  await svc.from('dd_referrals').insert({
    referrer_id: referrer.id,
    referee_id: ddUser.id,
    status: 'pending',
    referrer_credit: CREDIT,
    referee_credit: CREDIT,
  })

  await svc.from('dd_users').update({ referred_by: referrer.id }).eq('id', ddUser.id)

  return NextResponse.json({ success: true, message: `Referral code applied! Both of you get $${CREDIT.toFixed(0)} after your first delivery.` })
}
