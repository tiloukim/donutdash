import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { assignNextDriver } from '@/lib/delivery-assignment'

export async function GET(req: NextRequest) {
  // Verify the request is from Vercel Cron
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()

  // Find expired pending offers
  const { data: expiredOffers } = await svc
    .from('dd_delivery_offers')
    .select('id, delivery_id')
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString())

  if (!expiredOffers?.length) {
    return NextResponse.json({ expired: 0 })
  }

  // Mark them as expired
  // Guard on status: a driver accepting between the SELECT above and this
  // UPDATE would otherwise have their accepted offer overwritten as 'expired',
  // leaving the delivery assigned but the offer history saying nobody took it.
  const offerIds = expiredOffers.map(o => o.id)
  const { data: actuallyExpired } = await svc
    .from('dd_delivery_offers')
    .update({ status: 'expired' })
    .in('id', offerIds)
    .eq('status', 'pending')
    .select('id, delivery_id')

  // Only re-offer deliveries whose offer this run actually expired.
  // assignNextDriver no-ops on an already-assigned delivery, but re-offering
  // one a driver just accepted is wasted work and noisy in the logs.
  const deliveryIds = [...new Set((actuallyExpired || []).map(o => o.delivery_id))]
  for (const deliveryId of deliveryIds) {
    await assignNextDriver(deliveryId)
  }

  return NextResponse.json({ expired: (actuallyExpired || []).length, reassigned: deliveryIds.length })
}
