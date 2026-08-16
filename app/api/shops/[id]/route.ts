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

    // Never expose owner PII / financial internals on this public endpoint.
    const SENSITIVE = ['owner_id', 'tax_id', 'commission_pct', 'owner_pin_hash', 'owner_pin_salt', 'owner_pin_failed_attempts', 'owner_pin_locked_until']
    const safe = { ...shop } as Record<string, unknown>
    for (const k of SENSITIVE) delete safe[k]

    return NextResponse.json({ shop: safe })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
