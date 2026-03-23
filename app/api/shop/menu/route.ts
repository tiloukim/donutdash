import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function getShop() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) return null

  const { data: shop } = await svc.from('dd_shops').select('id').eq('owner_id', ddUser.id).single()
  return shop ? { shop, svc } : null
}

export async function GET() {
  const ctx = await getShop()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await ctx.svc.from('dd_menu_items').select('*').eq('shop_id', ctx.shop.id).order('sort_order').order('name')
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const ctx = await getShop()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { data, error } = await ctx.svc.from('dd_menu_items').insert({ ...body, shop_id: ctx.shop.id }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PUT(req: Request) {
  const ctx = await getShop()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...updates } = await req.json()
  const { data, error } = await ctx.svc.from('dd_menu_items').update(updates).eq('id', id).eq('shop_id', ctx.shop.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const ctx = await getShop()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()

  // Try hard delete first
  const { error } = await ctx.svc.from('dd_menu_items').delete().eq('id', id).eq('shop_id', ctx.shop.id)
  if (error) {
    // FK constraint — item has orders. Soft-delete by hiding it
    const { error: updateErr } = await ctx.svc.from('dd_menu_items')
      .update({ is_available: false, name: '[DELETED] ' + (await ctx.svc.from('dd_menu_items').select('name').eq('id', id).single()).data?.name })
      .eq('id', id).eq('shop_id', ctx.shop.id)
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
    return NextResponse.json({ success: true, note: 'Item hidden (has past orders)' })
  }
  return NextResponse.json({ success: true })
}
