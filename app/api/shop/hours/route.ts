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
  const { data } = await ctx.svc.from('dd_business_hours').select('*').eq('shop_id', ctx.shop.id).order('day_of_week')
  return NextResponse.json(data || [])
}

export async function PUT(req: Request) {
  const ctx = await getShop()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const hours = await req.json()
  for (const h of hours) {
    await ctx.svc.from('dd_business_hours').upsert({
      shop_id: ctx.shop.id,
      day_of_week: h.day_of_week,
      open_time: h.open_time,
      close_time: h.close_time,
      is_closed: h.is_closed,
    }, { onConflict: 'shop_id,day_of_week' })
  }
  return NextResponse.json({ success: true })
}
