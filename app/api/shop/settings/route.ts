import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function getShop() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'shop_owner' && ddUser.role !== 'admin')) return null
  const { data: shop } = await svc.from('dd_shops').select('*').eq('owner_id', ddUser.id).single()
  return shop ? { shop, svc } : null
}

export async function GET() {
  const ctx = await getShop()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(ctx.shop)
}

export async function PUT(req: Request) {
  const ctx = await getShop()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowed = ['name', 'description', 'address', 'city', 'state', 'zip', 'country', 'phone', 'delivery_fee', 'min_order', 'service_fee_pct', 'image_url', 'banner_url', 'lat', 'lng']
  const updates: Record<string, any> = {}
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key]
  }
  const { data, error } = await ctx.svc.from('dd_shops').update(updates).eq('id', ctx.shop.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
