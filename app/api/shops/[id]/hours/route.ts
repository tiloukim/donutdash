import { NextRequest, NextResponse } from 'next/server'
import { getShopHoursInfo } from '@/lib/shop-hours'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Returns open/closed status plus the weekly schedule and the next opening
  // slot, so the checkout scheduler can offer a valid time when closed.
  const info = await getShopHoursInfo(id)
  return NextResponse.json(info)
}
