import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ favorite_shop_ids: [] })
    }

    // Look up dd_users row by auth_id
    const { data: ddUser } = await supabase
      .from('dd_users')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (!ddUser) {
      return NextResponse.json({ favorite_shop_ids: [] })
    }

    const { data: favorites, error } = await supabase
      .from('dd_favorites')
      .select('shop_id')
      .eq('user_id', ddUser.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      favorite_shop_ids: (favorites || []).map(f => f.shop_id),
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { shop_id } = await request.json()
    if (!shop_id) {
      return NextResponse.json({ error: 'shop_id required' }, { status: 400 })
    }

    // Look up dd_users row by auth_id
    const { data: ddUser } = await supabase
      .from('dd_users')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (!ddUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if already favorited
    const { data: existing } = await supabase
      .from('dd_favorites')
      .select('id')
      .eq('user_id', ddUser.id)
      .eq('shop_id', shop_id)
      .single()

    if (existing) {
      // Remove favorite
      await supabase
        .from('dd_favorites')
        .delete()
        .eq('id', existing.id)

      return NextResponse.json({ favorited: false })
    } else {
      // Add favorite
      const { error } = await supabase
        .from('dd_favorites')
        .insert({ user_id: ddUser.id, shop_id })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ favorited: true })
    }
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
