import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { assignNextDriver } from '@/lib/delivery-assignment'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser || ddUser.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  // Find all pending deliveries with no driver assigned
  const { data: pendingDeliveries } = await svc
    .from('dd_deliveries')
    .select('id, order_id, status, driver_id')
    .eq('status', 'pending')
    .is('driver_id', null)

  if (!pendingDeliveries?.length) {
    return NextResponse.json({ message: 'No pending deliveries to retrigger', count: 0 })
  }

  const results = []
  for (const delivery of pendingDeliveries) {
    const result = await assignNextDriver(delivery.id)
    results.push({
      delivery_id: delivery.id,
      order_id: delivery.order_id,
      offer_sent: !!result?.data,
      offer_id: result?.data?.id || null,
      error: result?.error?.message || null,
    })
  }

  return NextResponse.json({
    message: `Retriggered ${pendingDeliveries.length} deliveries`,
    results,
  })
}
