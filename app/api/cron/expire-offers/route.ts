import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { assignNextDriver } from '@/lib/delivery-assignment'

// This endpoint should be called periodically (e.g., every 30 seconds via Vercel Cron or client-side)
export async function GET() {
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
