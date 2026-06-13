import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST was removed: previous handler trusted client-supplied subtotal/total/
// payment_id and inserted the row verbatim, letting any signed-in user
// place a $0.01 paid order or mark someone else's payment_id as paid.
// All real checkout flows go through /api/checkout (Square) or
// /api/stripe/checkout + /api/stripe/webhook (Stripe), which compute money
// server-side from menu_item lookups.

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the dd_users record
    const { data: ddUser } = await supabase
      .from('dd_users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single()

    if (!ddUser) {
      return NextResponse.json({ orders: [] })
    }

    const { data: orders, error } = await supabase
      .from('dd_orders')
      .select('*, shop:dd_shops(*), items:dd_order_items(*), delivery:dd_deliveries(delivery_photo_url)')
      .eq('customer_id', ddUser.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ orders: orders || [] })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

