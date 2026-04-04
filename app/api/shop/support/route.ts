import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: shop } = await svc.from('dd_shops').select('id').eq('owner_id', ddUser.id).single()
  if (!shop) return NextResponse.json({ error: 'No shop' }, { status: 404 })

  // Mark admin messages as read
  await svc.from('dd_support_messages')
    .update({ is_read: true })
    .eq('shop_id', shop.id)
    .eq('sender_role', 'admin')
    .eq('is_read', false)

  const { data: messages, error } = await svc
    .from('dd_support_messages')
    .select('*, sender:dd_users!sender_id(name)')
    .eq('shop_id', shop.id)
    .order('created_at', { ascending: true })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ messages: messages || [], user_id: ddUser.id, shop_id: shop.id })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: shop } = await svc.from('dd_shops').select('id').eq('owner_id', ddUser.id).single()
  if (!shop) return NextResponse.json({ error: 'No shop' }, { status: 404 })

  const { message } = await req.json()
  if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })

  const { data: msg, error } = await svc
    .from('dd_support_messages')
    .insert({
      shop_id: shop.id,
      sender_id: ddUser.id,
      sender_role: 'shop_owner',
      message: message.trim().slice(0, 1000),
    })
    .select('*, sender:dd_users!sender_id(name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: msg })
}
