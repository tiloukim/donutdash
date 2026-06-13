import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { order_id } = await req.json()
    if (!order_id) return NextResponse.json({ error: 'Missing order_id' }, { status: 400 })

    const svc = createServiceClient()

    // Get order
    const { data: order } = await svc
      .from('dd_orders')
      .select('*, shop:dd_shops(lat, lng)')
      .eq('id', order_id)
      .single()

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    // Ownership check — without this any signed-in user can probe order
    // IDs and learn status + delivery_id of someone else's order.
    const { data: caller } = await svc
      .from('dd_users')
      .select('id, role')
      .eq('auth_id', user.id)
      .maybeSingle()
    const isAdmin = caller?.role === 'admin'
      || caller?.role === 'general_manager'
      || caller?.role === 'field_manager'
    if (!isAdmin && caller?.id !== order.customer_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // This endpoint is called from checkout success page.
    // Don't auto-confirm or create deliveries here — the shop will accept the order
    // and trigger driver assignment via PATCH /api/orders/[id].
    // Just return success so the checkout success page can show confirmation.

    // Check if delivery record already exists (may have been created by shop accept)
    const { data: existing } = await svc
      .from('dd_deliveries')
      .select('id')
      .eq('order_id', order_id)
      .maybeSingle()

    return NextResponse.json({
      confirmed: true,
      delivery_id: existing?.id || null,
      status: order.status,
    })
  } catch (err) {
    console.error('Confirm error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to confirm' }, { status: 500 })
  }
}
