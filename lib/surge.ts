import { createServiceClient } from '@/lib/supabase/server'
import { SURGE_THRESHOLD_ORDERS, SURGE_MULTIPLIER, SHOP_BUSY_THRESHOLD } from '@/lib/constants'

export async function getSurgeMultiplier(): Promise<{ multiplier: number; isActive: boolean }> {
  const svc = createServiceClient()
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { count, error } = await svc
    .from('dd_orders')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneHourAgo)
    .not('status', 'in', '("cancelled","delivered")')

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
    .not('status', 'in', '("cancelled","delivered")')

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
