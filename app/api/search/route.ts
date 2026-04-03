import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()

    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] })
    }

    // Search menu items by name, joining with active shops
    const { data: items, error } = await supabase
      .from('dd_menu_items')
      .select(`
        id,
        name,
        price,
        image_url,
        shop:dd_shops!inner (
          id,
          name,
          slug,
          image_url
        )
      `)
      .ilike('name', `%${q}%`)
      .eq('is_available', true)
      .eq('dd_shops.is_active', true)
      .limit(20)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Group results by shop
    const shopMap = new Map<string, {
      shop: { id: string; name: string; slug: string; image_url: string | null };
      items: { name: string; price: number; image_url: string | null }[];
    }>()

    for (const item of items || []) {
      const shop = item.shop as unknown as { id: string; name: string; slug: string; image_url: string | null }
      if (!shop) continue

      if (!shopMap.has(shop.id)) {
        shopMap.set(shop.id, { shop, items: [] })
      }
      shopMap.get(shop.id)!.items.push({
        name: item.name,
        price: item.price,
        image_url: item.image_url,
      })
    }

    return NextResponse.json({ results: Array.from(shopMap.values()) })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
