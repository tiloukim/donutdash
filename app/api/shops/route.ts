import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')

    let query = supabase
      .from('dd_shops')
      .select('*')
      .eq('is_active', true)
      .order('rating', { ascending: false })

    if (slug) {
      query = query.eq('slug', slug)
    }

    const { data: shops, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ shops: shops || [] })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
