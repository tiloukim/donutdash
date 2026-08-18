import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const revalidate = 300 // cache 5 min — public, non-personalized

// Curated "featured treats" for the landing page: real, available, photographed
// menu items from shops you can actually order from. We deliberately lead with
// the signature items (cro-nuts, kolaches, fritters, croissants…) so the grid
// shows variety rather than a wall of glazed donuts.
const SIGNATURE = [
  'cro-nut', 'cronut', 'kolache', 'apple fritter', 'fritter', 'croissant',
  'long john', 'glazed', 'chocolate', 'sprinkle', 'twist', 'cake', 'icing', 'boudin',
]

export async function GET() {
  const svc = createServiceClient()

  const { data: allShops } = await svc
    .from('dd_shops')
    .select('id, name, slug, is_claimed')
    .eq('is_active', true)
  const shops = (allShops || []).filter(s => s.is_claimed !== false)
  if (shops.length === 0) return NextResponse.json({ items: [] })

  const shopMap = new Map(shops.map(s => [s.id, s]))
  const { data: rawItems } = await svc
    .from('dd_menu_items')
    .select('id, name, price, image_url, category, shop_id')
    .in('shop_id', shops.map(s => s.id))
    .eq('is_available', true)
    .not('image_url', 'is', null)
  const items = rawItems || []

  const shape = (it: (typeof items)[number]) => {
    const shop = shopMap.get(it.shop_id)
    return { id: it.id, name: it.name, price: it.price, image_url: it.image_url, category: it.category, shop_name: shop?.name || '', shop_slug: shop?.slug || '' }
  }

  const usedNames = new Set<string>()
  const picked: ReturnType<typeof shape>[] = []
  const take = (it: (typeof items)[number]) => {
    const key = it.name.toLowerCase().trim()
    if (usedNames.has(key)) return
    usedNames.add(key)
    picked.push(shape(it))
  }

  // 1) One item per signature term, in showcase order.
  for (const term of SIGNATURE) {
    if (picked.length >= 12) break
    const match = items.find(it => !usedNames.has(it.name.toLowerCase().trim()) && it.name.toLowerCase().includes(term))
    if (match) take(match)
  }
  // 2) Fill remaining slots with any other available items.
  for (const it of items) {
    if (picked.length >= 12) break
    take(it)
  }

  return NextResponse.json({ items: picked.slice(0, 12) })
}
