import type { SupabaseClient } from '@supabase/supabase-js'
import { refundSquareOrder } from '@/lib/square-refund'
import { notifyAdmins } from '@/lib/sms'

/**
 * A customer answering the "we sent something else instead" text.
 *
 * The substitution is already made and the food is already being prepared —
 * most online orders are ASAP, so holding one for ten minutes waiting on a
 * reply would stall the counter for an answer that frequently never comes.
 * Silence is therefore the yes, and this path exists only for the NO.
 */

// Loosely typed on purpose: dd_substitution_offers ships with
// supabase/substitution-offers.sql and is not in the generated Database
// types, so a strictly-typed client infers `never` for it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Svc = SupabaseClient<any, any, any>

// Deliberately narrow. A customer texting back "no thanks" or "nope" means
// the same thing, but "I know you said no onions" does not — so the message
// has to be SHORT and essentially only the refusal, or we leave it alone and
// let it reach a human. Guessing wrong here refunds an order nobody wanted
// refunded.
//
// CANCEL and YES are deliberately absent. They are 10DLC compliance keywords
// — CANCEL unsubscribes, YES re-subscribes — and those must keep working
// exactly as the carrier expects, whatever else is going on with an order.
// Claiming them here would have silently broken opt-out. NO is safe, and is
// what the message asks for; acceptance needs no keyword at all, because
// silence is already the yes.
const REJECT = /^\s*(no|n|nope|no thanks|no thank you|refund)\s*[.!]?\s*$/i
const ACCEPT = /^\s*(yep|ok|okay|fine|sure|thanks|thank you)\s*[.!]?\s*$/i

export type SubstitutionReply =
  | { handled: false }
  | { handled: true; kind: 'rejected'; refunded: number; reply: string }
  | { handled: true; kind: 'accepted'; reply: string }

/**
 * Returns handled:false when this message is not an answer to an open offer,
 * so the caller carries on with whatever it did before (forwarding to the
 * driver, etc). Never throws — an inbound webhook that 500s gets retried by
 * the carrier, which would refund twice.
 */
export async function handleSubstitutionReply(
  svc: Svc,
  fromPhone: string,
  body: string,
): Promise<SubstitutionReply> {
  try {
    const isReject = REJECT.test(body)
    const isAccept = ACCEPT.test(body)
    if (!isReject && !isAccept) return { handled: false }

    // Match on the phone we texted, within the window, unresolved.
    const alt = fromPhone.startsWith('+1') ? fromPhone.slice(2) : `+1${fromPhone}`
    const { data: offers } = await svc
      .from('dd_substitution_offers')
      .select('id, order_id, order_item_id, original_name, replacement_name, refund_amount')
      .or(`customer_phone.eq.${fromPhone},customer_phone.eq.${alt}`)
      .is('resolved_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true })
    if (!offers || offers.length === 0) return { handled: false }

    if (isAccept) {
      await svc.from('dd_substitution_offers')
        .update({ resolved_at: new Date().toISOString(), outcome: 'accepted_silently' })
        .in('id', offers.map((o) => o.id))
      return { handled: true, kind: 'accepted', reply: 'Thanks! Your order is on its way as it stands.' }
    }

    // ── Refusal ──
    const orderId = offers[0].order_id
    const { data: order } = await svc
      .from('dd_orders')
      .select('id, short_code, status, total, subtotal, tax, service_fee, refund_amount, payment_method, payment_id')
      .eq('id', orderId)
      .maybeSingle<{
        id: string; short_code: string | null; status: string; total: number
        subtotal: number; tax: number; service_fee: number; refund_amount: number | null
        payment_method: string | null; payment_id: string | null
      }>()
    if (!order) return { handled: false }

    // Once the food has left the shop, a text cannot undo it. Route it to a
    // human rather than refunding something the customer is holding.
    if (['picked_up', 'delivering', 'delivered', 'cancelled'].includes(order.status)) {
      await notifyAdmins(
        `Customer refused a substitution on #${order.short_code ?? orderId.slice(0, 8)} AFTER it left the shop (${order.status}). Needs a human.`,
        'Late substitution refusal',
      )
      return {
        handled: true, kind: 'rejected', refunded: 0,
        reply: 'Sorry — your order has already left the shop, so we can’t change it automatically. We’ll be in touch.',
      }
    }

    const mine = offers.filter((o) => o.order_id === orderId)
    const refund = Math.round(mine.reduce((sum, o) => sum + Number(o.refund_amount), 0) * 100) / 100

    let refunded = false
    if (order.payment_method === 'square' && refund > 0) {
      const res = await refundSquareOrder({
        orderId,
        paymentId: order.payment_id,
        amountCents: Math.round(refund * 100),
        reason: `Customer declined substitution: ${mine.map((o) => o.replacement_name).join(', ')}`,
        // One refusal, one refund, however many times the carrier retries
        // this webhook.
        idempotencyKey: `sub-reject-${orderId}-${Math.round(refund * 100)}`,
      })
      refunded = res.success
      if (!res.success) console.error('[sub-reply] refund failed for', orderId, res.error)
    }

    // Drop the lines the customer refused, and bring the order down with them.
    const itemIds = mine.map((o) => o.order_item_id).filter(Boolean) as string[]
    if (itemIds.length) await svc.from('dd_order_items').delete().in('id', itemIds)

    const ratio = Number(order.subtotal) > 0 ? refund / Number(order.total || 1) : 0
    await svc.from('dd_orders').update({
      subtotal: Math.round(Math.max(0, Number(order.subtotal) * (1 - ratio)) * 100) / 100,
      tax: Math.round(Math.max(0, Number(order.tax || 0) * (1 - ratio)) * 100) / 100,
      service_fee: Math.round(Math.max(0, Number(order.service_fee || 0) * (1 - ratio)) * 100) / 100,
      total: Math.round(Math.max(0, Number(order.total) - refund) * 100) / 100,
      refund_amount: Math.round((Number(order.refund_amount || 0) + refund) * 100) / 100,
      ...(refunded ? { refunded_at: new Date().toISOString(), refund_method: 'return' } : {
        reconcile_flag: 'refund_owed',
        reconcile_note: `$${refund.toFixed(2)} owed — customer declined a substitution and ${order.payment_method ?? 'this payment type'} has no automatic refund here.`,
      }),
    }).eq('id', orderId)

    await svc.from('dd_substitution_offers')
      .update({ resolved_at: new Date().toISOString(), outcome: 'rejected' })
      .in('id', mine.map((o) => o.id))

    // The kitchen is already making it. Somebody has to be told to stop.
    await notifyAdmins(
      `Customer declined the substitution on #${order.short_code ?? orderId.slice(0, 8)} — ${mine.map((o) => o.replacement_name).join(', ')} removed, $${refund.toFixed(2)} ${refunded ? 'refunded' : 'OWED (refund by hand)'}. Tell the kitchen.`,
      'Substitution declined',
    )

    return {
      handled: true, kind: 'rejected', refunded: refund,
      reply: refunded
        ? `No problem — we've removed it and refunded $${refund.toFixed(2)}. Sorry we were out!`
        : `No problem — we've removed it and a $${refund.toFixed(2)} refund is on its way. Sorry we were out!`,
    }
  } catch (e) {
    console.error('[sub-reply] failed', e)
    return { handled: false }
  }
}
