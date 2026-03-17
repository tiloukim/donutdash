import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser || ddUser.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  // Get all deliveries with their order's shop coordinates
  const { data: deliveries } = await svc
    .from('dd_deliveries')
    .select('id, pickup_lat, pickup_lng, order:dd_orders(shop:dd_shops(lat, lng))')

  if (!deliveries?.length) {
    return NextResponse.json({ message: 'No deliveries found', count: 0 })
  }

  let updated = 0
  for (const d of deliveries) {
    const shop = (d.order as any)?.shop
    if (shop?.lat && shop?.lng && (d.pickup_lat !== shop.lat || d.pickup_lng !== shop.lng)) {
      await svc.from('dd_deliveries')
        .update({ pickup_lat: shop.lat, pickup_lng: shop.lng })
        .eq('id', d.id)
      updated++
    }
  }

  return NextResponse.json({ message: `Updated ${updated} deliveries with current shop coordinates`, updated })
}
