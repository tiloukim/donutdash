import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const svc = createServiceClient()

  const { data: reviews } = await svc
    .from('dd_reviews')
    .select('id, shop_rating, driver_rating, comment, created_at, customer:dd_users!customer_id(name)')
    .eq('shop_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ reviews: reviews || [] })
}
