import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const VALID_REASONS = ['wrong_items', 'missing_items', 'cold_food', 'late_delivery', 'never_delivered', 'damaged', 'other']

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  try {
    const { data: dispute, error } = await svc
      .from('dd_disputes')
      .select('*')
      .eq('order_id', id)
      .eq('customer_id', ddUser.id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ dispute: null })
    }

    return NextResponse.json({ dispute })
  } catch {
    return NextResponse.json({ dispute: null })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('id, role').eq('auth_id', user.id).single()
  if (!ddUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Verify order exists, belongs to customer, and is delivered
  const { data: order } = await svc
    .from('dd_orders')
    .select('id, customer_id, status, total')
    .eq('id', id)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.customer_id !== ddUser.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (order.status !== 'delivered') {
    return NextResponse.json({ error: 'Order must be delivered before filing a dispute' }, { status: 400 })
  }

  // Check if dispute already exists
  const { data: existing } = await svc
    .from('dd_disputes')
    .select('id')
    .eq('order_id', id)
    .eq('customer_id', ddUser.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'A dispute has already been filed for this order' }, { status: 409 })
  }

  const body = await req.json()
  const { reason, description, refund_amount } = body

  if (!reason || !VALID_REASONS.includes(reason)) {
    return NextResponse.json({ error: 'Invalid reason' }, { status: 400 })
  }

  const amount = refund_amount ? Math.min(Number(refund_amount), Number(order.total)) : Number(order.total)

  try {
    const { data: dispute, error } = await svc
      .from('dd_disputes')
      .insert({
        order_id: id,
        customer_id: ddUser.id,
        reason,
        description: description?.trim() || null,
        refund_amount: amount,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('[DISPUTE] Failed to create dispute:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, dispute })
  } catch (err) {
    console.error('[DISPUTE] Unexpected error:', err)
    return NextResponse.json({ error: 'Failed to create dispute' }, { status: 500 })
  }
}
