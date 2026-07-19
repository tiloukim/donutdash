// Shared loyalty award logic — single source of truth for the earn rate,
// tier thresholds, and the dd_loyalty / dd_loyalty_transactions writes.
//
// Used by online checkout (Square), the Stripe webhook, and the POS walk-in
// sale route. Keeping it here means every channel earns points identically.

import type { SupabaseClient } from '@supabase/supabase-js'

/** Earn rate: 1 point per $1 of subtotal. */
export function pointsForSubtotal(subtotal: number): number {
  return Math.floor(Number(subtotal) || 0)
}

/** Tier by lifetime points. Mirrors getTier in /api/loyalty. */
export function tierForLifetime(lifetimePoints: number): 'bronze' | 'silver' | 'gold' | 'platinum' {
  if (lifetimePoints >= 5000) return 'platinum'
  if (lifetimePoints >= 1500) return 'gold'
  if (lifetimePoints >= 500) return 'silver'
  return 'bronze'
}

export interface LoyaltyAward {
  /** Points earned on this order. */
  earned: number
  /** New spendable balance after this award. */
  points: number
  /** New lifetime total after this award. */
  lifetime_points: number
  /** Tier after this award. */
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
}

/**
 * Award loyalty points for an order and log the transaction. Idempotency note:
 * the caller is responsible for only calling this once per order (order
 * creation is the natural single trigger). Returns the award, or null when no
 * points were earned (subtotal < $1) or no customer is attached.
 *
 * Pass a service-role client. Throws on a DB error so the caller can decide
 * whether to swallow it (online = fire-and-forget) or surface it.
 */
export async function awardLoyaltyPoints(
  svc: SupabaseClient,
  opts: {
    userId: string | null | undefined
    orderId: string
    subtotal: number
    source?: string
    /** When true, skip if this order already logged an 'earned' transaction.
     *  Used by the post-sale customer-attach path so points aren't awarded
     *  twice (once at creation, once on attach). */
    skipIfAwarded?: boolean
  },
): Promise<LoyaltyAward | null> {
  const { userId, orderId, subtotal, source } = opts
  if (!userId) return null
  const earned = pointsForSubtotal(subtotal)
  if (earned <= 0) return null

  if (opts.skipIfAwarded) {
    const { data: prior } = await svc
      .from('dd_loyalty_transactions')
      .select('id')
      .eq('order_id', orderId)
      .eq('type', 'earned')
      .maybeSingle()
    if (prior) return null
  }

  const { data: existing } = await svc
    .from('dd_loyalty')
    .select('points, lifetime_points')
    .eq('user_id', userId)
    .single()

  let points: number
  let lifetime_points: number
  if (existing) {
    points = existing.points + earned
    lifetime_points = existing.lifetime_points + earned
    const tier = tierForLifetime(lifetime_points)
    await svc
      .from('dd_loyalty')
      .update({ points, lifetime_points, tier, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
  } else {
    points = earned
    lifetime_points = earned
    const tier = tierForLifetime(lifetime_points)
    await svc.from('dd_loyalty').insert({ user_id: userId, points, lifetime_points, tier })
  }

  const suffix = source ? ` (${source})` : ''
  await svc.from('dd_loyalty_transactions').insert({
    user_id: userId,
    order_id: orderId,
    points: earned,
    type: 'earned',
    description: `Earned ${earned} pts from order #${orderId.slice(0, 8)}${suffix}`,
  })

  return { earned, points, lifetime_points, tier: tierForLifetime(lifetime_points) }
}
