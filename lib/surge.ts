import { createServiceClient } from '@/lib/supabase/server'
import { SURGE_THRESHOLD_ORDERS, SURGE_MULTIPLIER, SHOP_BUSY_THRESHOLD } from '@/lib/constants'

export async function getSurgeMultiplier(): Promise<{ multiplier: number; isActive: boolean }> {
  const svc = createServiceClient()
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  // Only count ACTIVE orders that are recent. The old query counted
  // every non-cancelled, non-delivered order created in the last hour —
  // which silently included abandoned 'pending' orders that never
  // advanced through the state machine, permanently keeping surge on.
  // Filter to in-progress statuses + filter by recent created_at.
  const { count, error } = await svc
    .from('dd_orders')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneHourAgo)
    .in('order_type', ['delivery', 'pickup']) // walk-ins don't affect dispatch
    .in('status', ['confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'delivering'])

  if (error) {
    console.error('Surge check error:', error)
    return { multiplier: 1.0, isActive: false }
  }

  const activeCount = count ?? 0
  if (activeCount >= SURGE_THRESHOLD_ORDERS) {
    return { multiplier: SURGE_MULTIPLIER, isActive: true }
  }

  return { multiplier: 1.0, isActive: false }
}

export async function getShopBusyness(shopIds: string[]): Promise<Record<string, boolean>> {
  if (shopIds.length === 0) return {}

  const svc = createServiceClient()

  const { data, error } = await svc
    .from('dd_orders')
    .select('shop_id')
    .in('shop_id', shopIds)
    // Only in-progress statuses. Same fix as getSurgeMultiplier — old
    // query included abandoned 'pending' orders that never advanced,
    // permanently marking a shop as busy.
    .in('status', ['confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'delivering'])
    .in('order_type', ['delivery', 'pickup'])

  if (error) {
    console.error('Shop busyness check error:', error)
    return {}
  }

  // Count orders per shop
  const counts: Record<string, number> = {}
  for (const row of data || []) {
    counts[row.shop_id] = (counts[row.shop_id] || 0) + 1
  }

  const result: Record<string, boolean> = {}
  for (const id of shopIds) {
    result[id] = (counts[id] || 0) >= SHOP_BUSY_THRESHOLD
  }

  return result
}
