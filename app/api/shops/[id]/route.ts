import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: shop, error } = await supabase
      .from('dd_shops')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    return NextResponse.json({ shop })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
