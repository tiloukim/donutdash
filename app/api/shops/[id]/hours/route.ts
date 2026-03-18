import { NextRequest, NextResponse } from 'next/server'
import { isShopOpen } from '@/lib/shop-hours'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const status = await isShopOpen(id)
  return NextResponse.json(status)
}
