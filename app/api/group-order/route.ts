import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// POST: Create a new group order
// GET: Get group order by share code
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const svc = createServiceClient()

    const { data: dbUser } = await svc
      .from('dd_users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single()

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { shop_id } = await req.json()
    if (!shop_id) {
      return NextResponse.json({ error: 'shop_id is required' }, { status: 400 })
    }

    // Generate a unique share code
    let shareCode = generateShareCode()
    let attempts = 0
    while (attempts < 5) {
      const { data: existing } = await svc
        .from('dd_group_orders')
        .select('id')
        .eq('share_code', shareCode)
        .single()
      if (!existing) break
      shareCode = generateShareCode()
      attempts++
    }

    const { data: groupOrder, error } = await svc
      .from('dd_group_orders')
      .insert({
        host_id: dbUser.id,
        shop_id,
        share_code: shareCode,
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create group order:', error)
      return NextResponse.json({ error: 'Failed to create group order' }, { status: 500 })
    }

    const origin = req.headers.get('origin') || req.headers.get('host') || ''
    const shareLink = `${origin.startsWith('http') ? origin : `https://${origin}`}/group-order/${shareCode}`

    return NextResponse.json({ groupOrder, shareLink, shareCode })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code')
    if (!code) {
      return NextResponse.json({ error: 'code parameter is required' }, { status: 400 })
    }

    const svc = createServiceClient()

    const { data: groupOrder, error } = await svc
      .from('dd_group_orders')
      .select('*')
      .eq('share_code', code.toUpperCase())
      .single()

    if (error || !groupOrder) {
      return NextResponse.json({ error: 'Group order not found' }, { status: 404 })
    }

    // Get shop info
    const { data: shop } = await svc
      .from('dd_shops')
      .select('id, name, slug, image_url, banner_url')
      .eq('id', groupOrder.shop_id)
      .single()

    // Get all items grouped by user
    const { data: items } = await svc
      .from('dd_group_order_items')
      .select('*')
      .eq('group_order_id', groupOrder.id)
      .order('created_at', { ascending: true })

    // Group items by user
    const itemsByUser: Record<string, { user_name: string; user_id: string; items: typeof items }> = {}
    for (const item of items || []) {
      if (!itemsByUser[item.user_id]) {
        itemsByUser[item.user_id] = {
          user_name: item.user_name || 'Anonymous',
          user_id: item.user_id,
          items: [],
        }
      }
      itemsByUser[item.user_id].items!.push(item)
    }

    // Get host info
    const { data: host } = await svc
      .from('dd_users')
      .select('id, name')
      .eq('id', groupOrder.host_id)
      .single()

    return NextResponse.json({
      groupOrder,
      shop,
      host,
      itemsByUser: Object.values(itemsByUser),
      allItems: items || [],
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
