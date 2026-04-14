import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Increment view count
  const { data: currentPost } = await svc.from('dd_forum_posts').select('view_count').eq('id', id).single()
  if (currentPost) {
    await svc.from('dd_forum_posts').update({ view_count: (currentPost.view_count || 0) + 1 }).eq('id', id)
  }

  const { data: post, error } = await svc
    .from('dd_forum_posts')
    .select('*, author:dd_users!author_id(name), category:dd_forum_categories!category_id(name, icon)')
    .eq('id', id)
    .single()

  if (error || !post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  const { data: replies } = await svc
    .from('dd_forum_replies')
    .select('*, author:dd_users!author_id(name)')
    .eq('post_id', id)
    .order('created_at', { ascending: true })
    .limit(200)

  return NextResponse.json({ post, replies: replies || [], user_id: ddUser.id })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, name, role').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { body } = await req.json()
  if (!body?.trim()) return NextResponse.json({ error: 'Body required' }, { status: 400 })

  const { data: reply, error } = await svc
    .from('dd_forum_replies')
    .insert({
      post_id: id,
      author_id: ddUser.id,
      body: body.trim().slice(0, 2000),
    })
    .select('*, author:dd_users!author_id(name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update post updated_at
  await svc.from('dd_forum_posts').update({ updated_at: new Date().toISOString() }).eq('id', id)

  return NextResponse.json({ reply })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: post } = await svc.from('dd_forum_posts').select('author_id').eq('id', id).single()
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  if (post.author_id !== ddUser.id && ddUser.role !== 'admin') {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const { error } = await svc.from('dd_forum_posts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
