import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { menuTemplate } from '@/lib/menu-template'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { data: shop } = await svc.from('dd_shops').select('id').eq('owner_id', ddUser.id).single()
  if (!shop) return NextResponse.json({ error: 'No shop found' }, { status: 404 })

  // Check if shop already has menu items
  const { count } = await svc.from('dd_menu_items').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id)
  if (count && count > 0) {
    return NextResponse.json({ error: 'Your menu already has items. Delete existing items first or add items manually.' }, { status: 400 })
  }

  // Insert all template items — price 0, shop owner must set their own prices
  const items = menuTemplate.map(item => ({
    shop_id: shop.id,
    name: item.name,
    description: item.description,
    price: 0,
    category: item.category,
    is_available: false,
    is_featured: item.is_featured,
    sort_order: item.sort_order,
    variants: item.variants
      ? item.variants.map(v => ({ name: v.name, options: v.options.map(o => ({ name: o, price: 0 })) }))
      : null,
  }))

  const { error } = await svc.from('dd_menu_items').insert(items)
  if (error) {
    console.error('Failed to load menu template:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, count: items.length })
}
