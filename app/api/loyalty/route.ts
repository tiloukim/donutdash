import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

function getTier(lifetimePoints: number): string {
  if (lifetimePoints >= 5000) return 'platinum'
  if (lifetimePoints >= 1500) return 'gold'
  if (lifetimePoints >= 500) return 'silver'
  return 'bronze'
}

export async function GET() {
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

    // Get or create loyalty record
    let { data: loyalty } = await svc
      .from('dd_loyalty')
      .select('*')
      .eq('user_id', ddUser.id)
      .single()

    if (!loyalty) {
      const { data: newLoyalty } = await svc
        .from('dd_loyalty')
        .insert({ user_id: ddUser.id })
        .select()
        .single()
      loyalty = newLoyalty
    }

    // Get recent transactions
    const { data: transactions } = await svc
      .from('dd_loyalty_transactions')
      .select('*')
      .eq('user_id', ddUser.id)
      .order('created_at', { ascending: false })
      .limit(20)

    // Ensure tier is up to date
    if (loyalty) {
      const correctTier = getTier(loyalty.lifetime_points)
      if (correctTier !== loyalty.tier) {
        await svc
          .from('dd_loyalty')
          .update({ tier: correctTier, updated_at: new Date().toISOString() })
          .eq('user_id', ddUser.id)
        loyalty.tier = correctTier
      }
    }

    return NextResponse.json({
      points: loyalty?.points || 0,
      lifetime_points: loyalty?.lifetime_points || 0,
      tier: loyalty?.tier || 'bronze',
      transactions: transactions || [],
    })
  } catch (err) {
    console.error('Loyalty GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch loyalty data' }, { status: 500 })
  }
}
