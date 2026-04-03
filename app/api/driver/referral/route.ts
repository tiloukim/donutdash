import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import crypto from 'crypto'

function generateDriverReferralCode(): string {
  return 'DRV' + crypto.randomBytes(3).toString('hex').toUpperCase()
}

// GET — get driver's shop referral code and stats
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

  // Get referrals where this driver referred a shop
  const { data: referrals } = await svc.from('dd_shop_referrals')
    .select('id, status, orders_completed, orders_required, referee_shop_id, referrer_credit, created_at, completed_at, shop:dd_shops!referee_shop_id(name)')
    .eq('referrer_user_id', ddUser.id)
    .order('created_at', { ascending: false })

  const completed = (referrals || []).filter(r => r.status === 'completed').length
  const totalEarned = completed * 100

  return NextResponse.json({
    referral_code: referralCode,
    referrals: referrals || [],
    completed_count: completed,
    total_earned: totalEarned,
  })
}
