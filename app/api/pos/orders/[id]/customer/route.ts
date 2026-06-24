import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { assertPosAccess } from '@/lib/pos-shop-auth'

// PATCH /api/pos/orders/:id/customer
// Post-sale customer attach. The cashier completes the walk-in sale and
// then realizes they want to attach a customer record (Square's "Add
// Customer" button on the Transaction Complete screen). Customer must
// have role='customer'. Pass customer_id=null to detach.

interface PatchBody {
  customer_id: string | null
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await createClient()
  const { data: userRes, error: userErr } = await auth.auth.getUser()
  if (userErr || !userRes?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const authId = userRes.user.id

  const { id: orderId } = await params
  if (!orderId) {
    return NextResponse.json({ error: 'Order id required' }, { status: 400 })
  }

  let body: PatchBody
  try {
    body = (await req.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const svc = createServiceClient()

  // Resolve caller profile + role.
  const { data: profile } = await svc
    .from('dd_users')
    .select('id, role')
    .eq('auth_id', authId)
    .maybeSingle()
  if (!profile) {
    return NextResponse.json({ error: 'No DonutDash profile' }, { status: 403 })
  }

  // Load the order so we can shop-scope the auth check.
  const { data: order, error: orderErr } = await svc
    .from('dd_orders')
    .select('id, shop_id, source')
    .eq('id', orderId)
    .maybeSingle()
  if (orderErr || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // POS-source guard: this endpoint is for walk-in sales attaching a
  // customer post-checkout. Online orders already have a customer.
  if (order.source !== 'pos') {
    return NextResponse.json({ error: 'Only POS orders can be reassigned' }, { status: 400 })
  }

  // Auth: admin OR shop owner of this order's shop.
  if (profile.role !== 'admin') {
    const { data: shop } = await svc
      .from('dd_shops')
      .select('id')
      .eq('id', order.shop_id)
      .eq('owner_id', profile.id)
      .maybeSingle()
    if (!shop) {
      return NextResponse.json({ error: 'You do not own this shop' }, { status: 403 })
    }
  }

  const gate = await assertPosAccess(svc, profile.id, order.shop_id)
  if (gate) return NextResponse.json({ error: gate.error }, { status: gate.status })

  // Validate the customer id if attaching (null is allowed for detach).
  if (body.customer_id != null) {
    const { data: customer } = await svc
      .from('dd_users')
      .select('id, role')
      .eq('id', body.customer_id)
      .eq('role', 'customer')
      .maybeSingle()
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }
  }

  const { error: updateErr } = await svc
    .from('dd_orders')
    .update({ customer_id: body.customer_id })
    .eq('id', orderId)
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ id: orderId, customer_id: body.customer_id })
}
