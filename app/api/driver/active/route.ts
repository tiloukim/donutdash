import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'driver' && ddUser.role !== 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data } = await svc.from('dd_deliveries')
    .select('*, order:dd_orders(*, dd_order_items(*), shop:dd_shops(name, address, city, state, phone), customer:dd_users!customer_id(name, phone))')
    .eq('driver_id', ddUser.id)
    .in('status', ['assigned', 'picked_up', 'delivering'])
    .limit(1)
    .single()

  if (!data) return NextResponse.json(null)

  return NextResponse.json({
    ...data,
    order: data.order ? { ...data.order, items: data.order.dd_order_items } : null,
  })
}
