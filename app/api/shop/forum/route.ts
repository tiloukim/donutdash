import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const categoryId = url.searchParams.get('category_id')
  const search = url.searchParams.get('search')

  // Fetch categories with post counts
  const { data: categories } = await svc
    .from('dd_forum_categories')
    .select('*')
    .order('sort_order', { ascending: true })

  // Build posts query
  let query = svc
    .from('dd_forum_posts')
    .select('*, author:dd_users!author_id(name, id), category:dd_forum_categories!category_id(name, icon), replies:dd_forum_replies(count)')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100)

  if (categoryId) {
    query = query.eq('category_id', categoryId)
  }
  if (search) {
    query = query.ilike('title', `%${search}%`)
  }

  const { data: posts, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get post counts per category
  const { data: postCounts } = await svc
    .from('dd_forum_posts')
    .select('category_id')

  const countMap: Record<string, number> = {}
  ;(postCounts || []).forEach((p: { category_id: string }) => {
    countMap[p.category_id] = (countMap[p.category_id] || 0) + 1
  })

  const categoriesWithCounts = (categories || []).map((c: { id: string; name: string; icon: string; description: string; sort_order: number }) => ({
    ...c,
    post_count: countMap[c.id] || 0,
  }))

  // Get shop names for all post authors
  const authorIds = [...new Set((posts || []).map((p: any) => p.author_id))]
  const { data: shops } = authorIds.length > 0
    ? await svc.from('dd_shops').select('owner_id, name').in('owner_id', authorIds)
    : { data: [] }
  const shopNameMap: Record<string, string> = {}
  for (const s of shops || []) shopNameMap[s.owner_id] = s.name

  // Flatten reply count + add shop name
  const formatted = (posts || []).map((p: any) => ({
    ...p,
    reply_count: p.replies?.[0]?.count || 0,
    replies: undefined,
    shop_name: shopNameMap[p.author_id] || null,
  }))

  return NextResponse.json({ posts: formatted, categories: categoriesWithCounts, user_id: ddUser.id })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, name, role').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { category_id, title, body, type, location, price, images } = await req.json()
  if (!category_id || !title?.trim() || !body?.trim()) {
    return NextResponse.json({ error: 'category_id, title, and body are required' }, { status: 400 })
  }

  const { data: post, error } = await svc
    .from('dd_forum_posts')
    .insert({
      category_id,
      author_id: ddUser.id,
      title: title.trim().slice(0, 200),
      body: body.trim().slice(0, 5000),
      type: type || 'discussion',
      location: location?.trim() || null,
      price: price || null,
      images: images || [],
    })
    .select('*, author:dd_users!author_id(name), category:dd_forum_categories!category_id(name, icon)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get shop name for the author
  const { data: authorShop } = await svc.from('dd_shops').select('name').eq('owner_id', ddUser.id).single()

  return NextResponse.json({ post: { ...post, reply_count: 0, shop_name: authorShop?.name || null } })
}
