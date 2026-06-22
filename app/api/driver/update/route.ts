import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendOrderEmail, buildOrderEmailHtml } from '@/lib/sms'
import { isReferralProgramEnabled } from '@/lib/referral'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: ddUser } = await svc.from('dd_users').select('*').eq('auth_id', user.id).single()
  if (!ddUser || (ddUser.role !== 'driver' && ddUser.role !== 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { delivery_id, status } = await req.json()

  const validTransitions: Record<string, string[]> = {
    assigned: ['picked_up'],
    picked_up: ['delivering'],
    delivering: ['delivered'],
  }

  // Get current delivery
  const { data: delivery } = await svc.from('dd_deliveries')
    .select('*')
    .eq('id', delivery_id)
    .eq('driver_id', ddUser.id)
    .single()

  if (!delivery) return NextResponse.json({ error: 'Delivery not found' }, { status: 404 })

  const allowed = validTransitions[delivery.status] || []
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: `Cannot transition from ${delivery.status} to ${status}` }, { status: 400 })
  }

  const updateData: any = { status }
  if (status === 'picked_up') updateData.picked_up_at = new Date().toISOString()
  if (status === 'delivered') updateData.delivered_at = new Date().toISOString()

  const { data: updated, error } = await svc.from('dd_deliveries')
    .update(updateData)
    .eq('id', delivery_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sync order status
  const orderStatusMap: Record<string, string> = {
    picked_up: 'picked_up',
    delivering: 'delivering',
    delivered: 'delivered',
  }

  if (orderStatusMap[status]) {
    await svc.from('dd_orders')
      .update({ status: orderStatusMap[status], updated_at: new Date().toISOString() })
      .eq('id', delivery.order_id)
  }

  // Send delivery status email to customer (fire and forget)
  {
    const { data: orderData } = await svc
      .from('dd_orders')
      .select('id, customer_id')
      .eq('id', delivery.order_id)
      .single()

    if (orderData) {
      const { data: customer } = await svc
        .from('dd_users')
        .select('email')
        .eq('id', orderData.customer_id)
        .single()

      if (customer?.email) {
        const orderId = orderData.id
        const driverMessages: Record<string, { subject: string; headline: string; message: string }> = {
          picked_up: {
            subject: `Order Picked Up - DonutDash #${orderId.slice(0, 8).toUpperCase()}`,
            headline: 'Order Picked Up!',
            message: 'Your order has been picked up by your driver and is heading your way!',
          },
          delivering: {
            subject: `Order On Its Way - DonutDash #${orderId.slice(0, 8).toUpperCase()}`,
            headline: 'Your Order is On Its Way!',
            message: 'Your driver is on the way to deliver your order. Get ready!',
          },
          delivered: {
            subject: `Order Delivered - DonutDash #${orderId.slice(0, 8).toUpperCase()}`,
            headline: 'Order Delivered!',
            message: 'Your order has been delivered. Enjoy your donuts!',
          },
        }

        const info = driverMessages[status]
        if (info) {
          const html = buildOrderEmailHtml(orderId, info.headline, info.message)
          sendOrderEmail(customer.email, info.subject, html).catch(() => {})
        }
      }
    }
  }

  // Complete pending referral on first delivered order
  if (status === 'delivered') {
    (async () => {
      // Referral program off → never award the $5 credit. Existing balances
      // are left untouched; this only stops new credits from accruing.
      if (!(await isReferralProgramEnabled(svc))) return

      const { data: orderData } = await svc.from('dd_orders').select('customer_id').eq('id', delivery.order_id).single()
      if (!orderData) return

      const { data: referral } = await svc.from('dd_referrals')
        .select('id, referrer_id, referee_id, referrer_credit, referee_credit')
        .eq('referee_id', orderData.customer_id)
        .eq('status', 'pending')
        .maybeSingle()

      if (!referral) return

      // Complete the referral and credit both users
      await svc.from('dd_referrals').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', referral.id)

      // Credit referrer
      const { data: referrer } = await svc.from('dd_users').select('referral_credit').eq('id', referral.referrer_id).single()
      if (referrer) {
        await svc.from('dd_users').update({ referral_credit: (Number(referrer.referral_credit) || 0) + Number(referral.referrer_credit) }).eq('id', referral.referrer_id)
      }

      // Credit referee
      const { data: referee } = await svc.from('dd_users').select('referral_credit').eq('id', referral.referee_id).single()
      if (referee) {
        await svc.from('dd_users').update({ referral_credit: (Number(referee.referral_credit) || 0) + Number(referral.referee_credit) }).eq('id', referral.referee_id)
      }
    })().catch(() => {})
  }

  // Track shop referral progress on delivered orders
  if (status === 'delivered') {
    (async () => {
      const { data: orderData } = await svc.from('dd_orders').select('shop_id').eq('id', delivery.order_id).single()
      if (!orderData) return

      // Find pending shop referral where this shop is the referee
      const { data: shopReferral } = await svc.from('dd_shop_referrals')
        .select('id, referrer_user_id, referee_user_id, referrer_credit, referee_credit, orders_completed, orders_required')
        .eq('referee_shop_id', orderData.shop_id)
        .eq('status', 'pending')
        .maybeSingle()

      if (!shopReferral) return

      const newCount = (shopReferral.orders_completed || 0) + 1
      if (newCount >= shopReferral.orders_required) {
        // Complete the shop referral — credit both shop owners
        await svc.from('dd_shop_referrals').update({ status: 'completed', orders_completed: newCount, completed_at: new Date().toISOString() }).eq('id', shopReferral.id)

        const { data: referrerUser } = await svc.from('dd_users').select('referral_credit').eq('id', shopReferral.referrer_user_id).single()
        if (referrerUser) {
          await svc.from('dd_users').update({ referral_credit: (Number(referrerUser.referral_credit) || 0) + Number(shopReferral.referrer_credit) }).eq('id', shopReferral.referrer_user_id)
        }
        const { data: refereeUser } = await svc.from('dd_users').select('referral_credit').eq('id', shopReferral.referee_user_id).single()
        if (refereeUser) {
          await svc.from('dd_users').update({ referral_credit: (Number(refereeUser.referral_credit) || 0) + Number(shopReferral.referee_credit) }).eq('id', shopReferral.referee_user_id)
        }
      } else {
        // Just increment the counter
        await svc.from('dd_shop_referrals').update({ orders_completed: newCount }).eq('id', shopReferral.id)
      }
    })().catch(() => {})
  }

  // Track driver-to-driver referral progress (10 deliveries required)
  if (status === 'delivered') {
    (async () => {
      // Check if this driver (ddUser.id) has a pending driver referral
      const { data: driverReferral } = await svc.from('dd_referrals')
        .select('id, referrer_id, referee_id, referrer_credit, referee_credit, deliveries_completed, deliveries_required')
        .eq('referee_id', ddUser.id)
        .eq('status', 'pending')
        .maybeSingle()

      if (!driverReferral) return

      const newCount = (driverReferral.deliveries_completed || 0) + 1
      const required = driverReferral.deliveries_required || 10

      if (newCount >= required) {
        // Complete — credit both drivers the amount stored on the referral row
        await svc.from('dd_referrals').update({ status: 'completed', deliveries_completed: newCount, completed_at: new Date().toISOString() }).eq('id', driverReferral.id)

        const { data: referrer } = await svc.from('dd_users').select('referral_credit').eq('id', driverReferral.referrer_id).single()
        if (referrer) {
          await svc.from('dd_users').update({ referral_credit: (Number(referrer.referral_credit) || 0) + Number(driverReferral.referrer_credit) }).eq('id', driverReferral.referrer_id)
        }
        const { data: referee } = await svc.from('dd_users').select('referral_credit').eq('id', driverReferral.referee_id).single()
        if (referee) {
          await svc.from('dd_users').update({ referral_credit: (Number(referee.referral_credit) || 0) + Number(driverReferral.referee_credit) }).eq('id', driverReferral.referee_id)
        }
      } else {
        await svc.from('dd_referrals').update({ deliveries_completed: newCount }).eq('id', driverReferral.id)
      }
    })().catch(() => {})
  }

  return NextResponse.json(updated)
}
