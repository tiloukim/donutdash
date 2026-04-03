import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import crypto from 'crypto'

function generateReferralCode(): string {
  return crypto.randomBytes(3).toString('hex').toUpperCase()
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()
    const { data: ddUser } = await svc.from('dd_users').select('id, referral_code, referral_credit').eq('auth_id', authUser.id).single()
    if (!ddUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Auto-generate referral code if none
    let referralCode = ddUser.referral_code
    if (!referralCode) {
      referralCode = generateReferralCode()
      await svc.from('dd_users').update({ referral_code: referralCode }).eq('id', ddUser.id)
    }

    // Get referral stats
    const { count } = await svc.from('dd_referrals').select('*', { count: 'exact', head: true }).eq('referrer_id', ddUser.id).eq('status', 'completed')

    return NextResponse.json({
      referral_code: referralCode,
      referral_count: count || 0,
      total_earned: Number(ddUser.referral_credit) || 0,
    })
  } catch (err) {
    console.error('Referral GET error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { referral_code } = await request.json()
    if (!referral_code) return NextResponse.json({ error: 'Missing referral code' }, { status: 400 })

    const svc = createServiceClient()
    const { data: ddUser } = await svc.from('dd_users').select('id, referred_by').eq('auth_id', authUser.id).single()
    if (!ddUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Check if already referred
    if (ddUser.referred_by) {
      return NextResponse.json({ error: 'You have already used a referral code' }, { status: 400 })
    }

    // Find referrer by code
    const { data: referrer } = await svc.from('dd_users').select('id, referral_credit').eq('referral_code', referral_code.toUpperCase()).single()
    if (!referrer) return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 })

    // Cannot refer yourself
    if (referrer.id === ddUser.id) {
      return NextResponse.json({ error: 'Cannot use your own referral code' }, { status: 400 })
    }

    const CREDIT = 1.00

    // Create referral record as pending — credit given after first order
    await svc.from('dd_referrals').insert({
      referrer_id: referrer.id,
      referee_id: ddUser.id,
      status: 'pending',
      referrer_credit: CREDIT,
      referee_credit: CREDIT,
    })

    // Mark user as referred but don't give credit yet
    await svc.from('dd_users').update({
      referred_by: referrer.id,
    }).eq('id', ddUser.id)

    return NextResponse.json({ success: true, message: 'Referral code applied! You and your friend will each get $1.00 credit after your first order.' })
  } catch (err) {
    console.error('Referral POST error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
