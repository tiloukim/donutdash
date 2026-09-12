import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { maskPhone } from '@/lib/mask-phone'
import { DRIVER_ORDER_FIELDS } from '@/lib/driver-order-fields'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'driver' && ddUser.role !== 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data } = await svc.from('dd_deliveries')
    .select(`*, order:dd_orders(${DRIVER_ORDER_FIELDS}, dd_order_items(*), shop:dd_shops(name, address, city, state, phone, lat, lng), customer:dd_users!customer_id(name, phone))`)
    .eq('driver_id', ddUser.id)
    .in('status', ['assigned', 'picked_up', 'delivering'])
    .order('created_at', { ascending: true })

  if (!data || data.length === 0) return NextResponse.json(null)

  // Drivers reach customers through /api/driver/contact, which resolves the
  // real number server-side and only for the driver assigned to that
  // delivery. Nothing client-side needs the digits, so both copies of the
  // phone go out masked — the joined profile phone and the order-time phone
  // the customer typed at checkout, which can be a different number.
  const deliveries = data.map(d => {
    const order = d.order ? {
      ...d.order,
      customer_phone: maskPhone(d.order.customer_phone),
      items: d.order.dd_order_items,
      customer: d.order.customer ? {
        ...d.order.customer,
        phone: maskPhone(d.order.customer.phone),
      } : null,
    } : null
    return { ...d, order }
  })

  // Return array in 'deliveries' field, plus first delivery as top-level for backwards compat
  return NextResponse.json({ ...deliveries[0], deliveries })
}
