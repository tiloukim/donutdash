import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canAccessAdminPortal, isAdmin } from '@/lib/admin-auth'
import { refundSquareOrder } from '@/lib/square-refund'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()
    const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
    if (!ddUser || !canAccessAdminPortal(ddUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: disputes, error } = await svc
      .from('dd_disputes')
      .select(`
        *,
        customer:dd_users!customer_id(id, name, email),
        order:dd_orders!order_id(id, total, status, created_at, shop_id, shop:dd_shops!shop_id(name)),
        resolver:dd_users!resolved_by(name)
      `)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ disputes: disputes || [] })
  } catch (err) {
    console.error('[ADMIN DISPUTES] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()
    const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
    if (!ddUser || !canAccessAdminPortal(ddUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { dispute_id, status, admin_notes } = body

    if (!dispute_id) return NextResponse.json({ error: 'dispute_id required' }, { status: 400 })
    if (!status || !['approved', 'rejected', 'refunded'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status. Must be approved, rejected, or refunded.' }, { status: 400 })
    }

    // Issuing a refund moves real money; admin-only. Other managers
    // can mark a dispute approved/rejected but can't trigger Square refund.
    if (status === 'refunded' && !isAdmin(ddUser.role)) {
      return NextResponse.json({ error: 'Only admins can issue refunds' }, { status: 403 })
    }

    let refundResult: { success: boolean; error?: string } | null = null

    if (status === 'refunded') {
      const { data: existing } = await svc
        .from('dd_disputes')
        .select('order_id, refund_amount, order:dd_orders!order_id(payment_method, total, refund_amount)')
        .eq('id', dispute_id)
        .single()

      const orderRaw = existing?.order as unknown
      const order = (Array.isArray(orderRaw) ? orderRaw[0] : orderRaw) as
        | { payment_method: string | null; total: number; refund_amount: number | null }
        | undefined
      if (existing?.order_id && order?.payment_method === 'square') {
        const requested = Number(existing.refund_amount) || 0
        const orderTotal = Number(order.total) || 0
        const alreadyRefunded = Number(order.refund_amount) || 0
        const refundable = Math.max(0, orderTotal - alreadyRefunded)
        const amount = Math.min(requested, refundable)
        if (amount > 0) {
          refundResult = await refundSquareOrder({
            orderId: existing.order_id,
            amountCents: Math.round(amount * 100),
            reason: 'Dispute resolved — refund issued',
            idempotencyKey: `refund-dispute-${dispute_id}`,
          })
          if (refundResult.success) {
            // Conditional update — refund_amount must still equal what
            // we read above. Two admins resolving the same dispute would
            // otherwise double-increment (Square's idempotency key
            // prevents the duplicate refund itself, but the DB write
            // would still drift).
            await svc.from('dd_orders').update({
              refund_amount: alreadyRefunded + amount,
            })
              .eq('id', existing.order_id)
              .eq('refund_amount', alreadyRefunded)
          } else {
            console.error('Square refund failed for dispute', dispute_id, refundResult.error)
            return NextResponse.json({
              error: `Refund failed: ${refundResult.error}. Dispute not updated — fix the payment in Square then retry.`,
            }, { status: 502 })
          }
        }
      }
    }

    const { data: dispute, error } = await svc
      .from('dd_disputes')
      .update({
        status,
        admin_notes: admin_notes?.trim() || null,
        resolved_at: new Date().toISOString(),
        resolved_by: ddUser.id,
      })
      .eq('id', dispute_id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, dispute, refund: refundResult })
  } catch (err) {
    console.error('[ADMIN DISPUTES] PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
