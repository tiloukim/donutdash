import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/server'

type Svc = ReturnType<typeof createServiceClient>

/**
 * Resolve the shop a merchant is currently acting on.
 *
 * Supports owners with MULTIPLE shops: the portal's shop switcher sets a
 * `dd_active_shop` cookie, which this reads. For owners with a single shop
 * (the overwhelming majority) it returns that shop with identical behavior to
 * the old `.eq('owner_id', id).single()` lookups — so existing shops are
 * completely unaffected. Returns null when the owner has no shop.
 *
 * Replaces the ~25 inlined single-shop lookups across app/api/shop/**.
 */
export async function resolveOwnerShop(svc: Svc, ownerId: string): Promise<Record<string, any> | null> {
  const { data: shops } = await svc
    .from('dd_shops')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: true })

  if (!shops || shops.length === 0) return null
  if (shops.length === 1) return shops[0]

  let wanted: string | undefined
  try { wanted = (await cookies()).get('dd_active_shop')?.value } catch { /* no request scope */ }
  if (wanted) {
    const match = shops.find(s => s.id === wanted)
    if (match) return match
  }
  return shops[0]
}

/** Convenience: just the active shop's id (or null). */
export async function resolveOwnerShopId(svc: Svc, ownerId: string): Promise<string | null> {
  const shop = await resolveOwnerShop(svc, ownerId)
  return shop?.id ?? null
}
