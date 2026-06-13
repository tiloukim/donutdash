import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canAccessAdminPortal } from '@/lib/admin-auth'

// GET: List all shops with support conversations + unread counts
// GET?shop_id=xxx: Get messages for a specific shop
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser || !canAccessAdminPortal(ddUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')

  if (shopId) {
    // Mark shop_owner messages as read
    await svc.from('dd_support_messages')
      .update({ is_read: true })
      .eq('shop_id', shopId)
      .eq('sender_role', 'shop_owner')
      .eq('is_read', false)

    const { data: messages, error } = await svc
      .from('dd_support_messages')
      .select('*, sender:dd_users!sender_id(name)')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: true })
      .limit(200)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ messages: messages || [], user_id: ddUser.id })
  }

  // List all shops with conversations
  const { data: allMessages, error } = await svc
    .from('dd_support_messages')
    .select('shop_id, sender_role, is_read, created_at, message, shop:dd_shops!shop_id(name)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Group by shop
  const shopMap = new Map<string, { shop_id: string; shop_name: string; last_message: string; last_at: string; unread: number }>()
  for (const m of allMessages || []) {
    if (!shopMap.has(m.shop_id)) {
      shopMap.set(m.shop_id, {
        shop_id: m.shop_id,
        shop_name: (m.shop as any)?.name || 'Shop',
        last_message: m.message,
        last_at: m.created_at,
        unread: 0,
      })
    }
    if (m.sender_role === 'shop_owner' && !m.is_read) {
      shopMap.get(m.shop_id)!.unread++
    }
  }

  const conversations = Array.from(shopMap.values()).sort((a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime())
  return NextResponse.json({ conversations })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser || !canAccessAdminPortal(ddUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { shop_id, message } = await req.json()
  if (!shop_id || !message?.trim()) return NextResponse.json({ error: 'shop_id and message required' }, { status: 400 })

  const { data: msg, error } = await svc
    .from('dd_support_messages')
    .insert({
      shop_id,
      sender_id: ddUser.id,
      sender_role: 'admin',
      message: message.trim().slice(0, 1000),
    })
    .select('*, sender:dd_users!sender_id(name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: msg })
}
