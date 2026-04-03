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
    .select('*, order:dd_orders(*, dd_order_items(*), shop:dd_shops(name, address, city, state, phone, lat, lng), customer:dd_users!customer_id(name, phone))')
    .eq('driver_id', ddUser.id)
    .in('status', ['assigned', 'picked_up', 'delivering'])
    .order('created_at', { ascending: true })

  if (!data || data.length === 0) return NextResponse.json(null)

  // Mask customer phone for privacy — only expose last 4 digits
  const deliveries = data.map(d => {
    const order = d.order ? {
      ...d.order,
      items: d.order.dd_order_items,
      customer: d.order.customer ? {
        ...d.order.customer,
        phone: d.order.customer.phone ? `***-***-${d.order.customer.phone.slice(-4)}` : null,
      } : null,
    } : null
    return { ...d, order }
  })

  // Return array in 'deliveries' field, plus first delivery as top-level for backwards compat
  return NextResponse.json({ ...deliveries[0], deliveries })
}
