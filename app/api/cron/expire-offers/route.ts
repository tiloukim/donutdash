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
  const offerIds = expiredOffers.map(o => o.id)
  await svc
    .from('dd_delivery_offers')
    .update({ status: 'expired' })
    .in('id', offerIds)

  // Try to reassign each delivery
  const deliveryIds = [...new Set(expiredOffers.map(o => o.delivery_id))]
  for (const deliveryId of deliveryIds) {
    await assignNextDriver(deliveryId)
  }

  return NextResponse.json({ expired: expiredOffers.length, reassigned: deliveryIds.length })
}
