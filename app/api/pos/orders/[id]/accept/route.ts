import { NextRequest, NextResponse } from 'next/server'
import { authorizeForShop } from '@/lib/pos-shop-auth'
import { refundSquareOrder } from '@/lib/square-refund'
import { sendSMS, toE164, notifyAdmins } from '@/lib/sms'

/**
 * POST /api/pos/orders/:id/accept
 *   { shop_id, changes?: [{ item_id, action: 'remove' | 'substitute',
 *                           replacement_menu_item_id? }] }
 *
 * Accept an online order, applying what the cashier decided about sold-out
 * lines, and refund anything removed.
 *
 * ── Why this exists ──
 * The register already let a cashier mark a line sold out and pick a
 * replacement, but that choice went nowhere: substitutions lived in React
 * state, were read once to draw an icon, and were discarded on accept. The
 * order rows, the kitchen ticket and the customer all still said the original
 * item. There was no way at all to drop a line and give the money back — the
 * only honest option was declining the whole order over one missing donut.
 *
 * ── What it does ──
 * Substitute swaps the line to the new item and KEEPS the original price.
 * That was the existing stated policy and it is the right one: a shop that
 * ran out should not profit from the swap, and should not have to chase a
 * customer for more either.
 *
 * Remove deletes the line and refunds it — the item, its share of tax, and
 * its share of the service fee, which is a percentage of subtotal. The
 * delivery fee and the tip are untouched: the delivery still happens, and the
 * tip is the customer's own decision about the person who brings it.
 */

interface Change {
  item_id: string
  action: 'remove' | 'substitute'
  replacement_menu_item_id?: string | null
}

const round = (n: number) => Math.round(n * 100) / 100

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const shopId: string = body?.shop_id
  const changes: Change[] = Array.isArray(body?.changes) ? body.changes : []
  if (!shopId) return NextResponse.json({ error: 'shop_id is required' }, { status: 400 })

  const auth = await authorizeForShop(shopId)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { svc } = auth

  const { data: order } = await svc
    .from('dd_orders')
    .select('id, status, shop_id, subtotal, tax, service_fee, delivery_fee, tip, total, payment_method, payment_id, customer_phone, customer_name, short_code, refund_amount')
    .eq('id', id)
    .eq('shop_id', shopId)
    .maybeSingle()
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  // Idempotent: a second accept with no changes is a no-op rather than an
  // error, because a register that lost the response will retry.
  if (order.status !== 'pending') {
    if (changes.length === 0) return NextResponse.json({ ok: true, alreadyAccepted: true })
    return NextResponse.json(
      { error: `This order is already ${order.status.replace(/_/g, ' ')} — line changes can only be made while it is pending.` },
      { status: 409 },
    )
  }

  const { data: items } = await svc
    .from('dd_order_items')
    .select('id, menu_item_id, name, price, quantity')
    .eq('order_id', id)
  const lines = items ?? []
  if (lines.length === 0) return NextResponse.json({ error: 'Order has no items' }, { status: 400 })

  // Every change must name a line that is actually on this order. Keyed by
  // the row id, never the array index: removing a line shifts every index
  // after it, and an index-keyed change would then hit the wrong item.
  const byId = new Map(lines.map((l) => [l.id, l]))
  for (const c of changes) {
    if (!byId.has(c.item_id)) {
      return NextResponse.json({ error: `Item ${c.item_id} is not on this order` }, { status: 400 })
    }
    if (c.action === 'substitute' && !c.replacement_menu_item_id) {
      return NextResponse.json({ error: 'A substitution needs replacement_menu_item_id' }, { status: 400 })
    }
  }

  const removals = changes.filter((c) => c.action === 'remove')
  const subs = changes.filter((c) => c.action === 'substitute')

  // Removing everything is a cancellation, and cancelling has its own route
  // with delivery cleanup and a full refund. Doing it here would leave an
  // empty confirmed order and a driver still on the way.
  if (removals.length === lines.length) {
    return NextResponse.json(
      { error: 'That removes every item. Decline the order instead so the customer is refunded in full and any delivery is cancelled.' },
      { status: 400 },
    )
  }

  const removedNames: string[] = []
  let removedSubtotal = 0
  for (const c of removals) {
    const l = byId.get(c.item_id)!
    removedSubtotal += Number(l.price) * Number(l.quantity)
    removedNames.push(l.quantity > 1 ? `${l.quantity}x ${l.name}` : l.name)
  }
  removedSubtotal = round(removedSubtotal)

  // Proportional, NOT recomputed from tax_rate: that column is null on every
  // real online order (only POS walk-ins set it), so deriving the rate from
  // the order's own tax is the only thing that works on live data. The
  // service fee is a percentage of subtotal and moves with it; the delivery
  // fee and tip do not.
  const oldSubtotal = Number(order.subtotal) || 0
  const ratio = oldSubtotal > 0 ? removedSubtotal / oldSubtotal : 0
  const removedTax = round(Number(order.tax || 0) * ratio)
  const removedServiceFee = round(Number(order.service_fee || 0) * ratio)
  // A cheaper replacement is charged down to its own price.
  //
  // "Customer keeps the original charge" is fair for a like-for-like swap, and
  // generous to them when the stand-in costs MORE — the shop ran out, so the
  // shop absorbs that. It is not fair the other way. The picker showed no
  // prices at all, so a $2.10 line could be swapped for a $1.35 one and the
  // customer still charged $2.10, without anyone choosing that outcome.
  //
  // Resolved read-only HERE, above the refund, because the difference is part
  // of what the customer is owed and the refund has to know about it before
  // any money moves.
  let substitutionRefund = 0
  const cheaperNotes: string[] = []
  const resolvedSubs: Array<{
    itemId: string; replacementId: string; replacementName: string
    newPrice: number; oldPrice: number; cheaperBy: number
  }> = []
  for (const c of subs) {
    const { data: replacement } = await svc
      .from('dd_menu_items')
      .select('id, name, price, pos_price, online_price')
      .eq('id', c.replacement_menu_item_id!)
      .eq('shop_id', shopId)
      .maybeSingle()
    if (!replacement) {
      return NextResponse.json({ error: "That replacement is not on this shop's menu" }, { status: 400 })
    }
    const original = byId.get(c.item_id)!
    // Refuse replacing an item with itself. The register's picker used to
    // offer the sold-out item as its own replacement, which does nothing to
    // the order and texts the customer "we were out of X so we sent X
    // instead". Guarded here as well as in the UI, because the UI is one
    // client and this is the contract.
    if (original.menu_item_id && original.menu_item_id === replacement.id) {
      return NextResponse.json(
        { error: `${replacement.name} is the item that is sold out — pick a different replacement, or remove and refund it.` },
        { status: 400 },
      )
    }
    // The ONLINE price is the comparison: it is what the customer paid.
    const newPrice = Number(replacement.online_price ?? replacement.pos_price ?? replacement.price ?? 0)
    const oldPrice = Number(original.price)
    const cheaperBy = newPrice > 0 && newPrice < oldPrice
      ? round((oldPrice - newPrice) * Number(original.quantity))
      : 0
    if (cheaperBy > 0) {
      substitutionRefund = round(substitutionRefund + cheaperBy)
      cheaperNotes.push(`${replacement.name} (-$${cheaperBy.toFixed(2)})`)
    }
    resolvedSubs.push({
      itemId: c.item_id, replacementId: replacement.id,
      replacementName: replacement.name, newPrice, oldPrice, cheaperBy,
    })
  }

  // Tax and service fee ride on the difference too — they were charged on a
  // figure that is coming down.
  const feeRate = oldSubtotal > 0
    ? (Number(order.tax || 0) + Number(order.service_fee || 0)) / oldSubtotal
    : 0
  const subTax = round(substitutionRefund * (oldSubtotal > 0 ? Number(order.tax || 0) / oldSubtotal : 0))
  const subServiceFee = round(substitutionRefund * (oldSubtotal > 0 ? Number(order.service_fee || 0) / oldSubtotal : 0))
  void feeRate

  const refundAmount = round(
    removedSubtotal + removedTax + removedServiceFee
    + substitutionRefund + subTax + subServiceFee,
  )

  // ── Money FIRST, when a processor refund is involved ──
  //
  // The first version of this deleted the lines and then tried to refund. A
  // failed refund there leaves the customer short the item AND the money,
  // with nothing on the order to say so. Refund first; if it fails, nothing
  // has changed and the cashier is told.
  let refunded = false
  let manualRefundOwed = false

  if (refundAmount > 0) {
    if (order.payment_method === 'square') {
      const result = await refundSquareOrder({
        orderId: id,
        paymentId: order.payment_id,
        amountCents: Math.round(refundAmount * 100),
        reason: [
          removedNames.length ? `Sold out: ${removedNames.join(', ')}` : '',
          cheaperNotes.length ? `Cheaper replacement: ${cheaperNotes.join(', ')}` : '',
        ].filter(Boolean).join(' | ') || 'Order adjusted',
        // Keyed by order AND amount: a retry of this same accept is one
        // refund at Square, while a different adjustment later still goes
        // through rather than being silently swallowed.
        idempotencyKey: `accept-refund-${id}-${Math.round(refundAmount * 100)}`,
      })
      if (!result.success) {
        console.error('[pos/accept] refund failed for', id, result.error)
        return NextResponse.json(
          {
            error: `Could not refund $${refundAmount.toFixed(2)} for ${removedNames.join(', ')}: ${result.error ?? 'refund failed'}. Nothing has been changed — accept without removing that item, or decline the order.`,
          },
          { status: 502 },
        )
      }
      refunded = true
    } else {
      // Stripe, PayPal and legacy 'card_online' have no automated refund path
      // here. Proceeding and writing refunded_at would assert a refund that
      // never happened — the exact flaw in /api/pos/orders/:id/refund, which
      // records money movement it never performs. Flag it instead so a human
      // actually sends it.
      manualRefundOwed = true
    }
  }

  // ── Apply the line changes ──
  for (const r of resolvedSubs) {
    await svc.from('dd_order_items').update({
      menu_item_id: r.replacementId,
      price: r.cheaperBy > 0 ? r.newPrice : r.oldPrice,
      name: `${r.replacementName} (sub for ${byId.get(r.itemId)!.name})`,
    }).eq('id', r.itemId)
  }

  if (removals.length > 0) {
    await svc.from('dd_order_items').delete().in('id', removals.map((c) => c.item_id))
  }

  if (refundAmount > 0) {
    const patch: Record<string, unknown> = {
      subtotal: round(oldSubtotal - removedSubtotal - substitutionRefund),
      tax: round(Number(order.tax || 0) - removedTax - subTax),
      service_fee: round(Number(order.service_fee || 0) - removedServiceFee - subServiceFee),
      total: round(Number(order.total) - refundAmount),
      // The running TOTAL refunded, matching /api/pos/orders/:id/refund
      // rather than adding to it.
      refund_amount: round(Number(order.refund_amount || 0) + refundAmount),
    }
    if (refunded) {
      patch.refunded_at = new Date().toISOString()
      // 'return' — the column records HOW the money went back (void /
      // return / cash), not which card was used. Writing the payment method
      // here trips dd_orders_refund_method_check.
      patch.refund_method = 'return'
    } else {
      patch.reconcile_flag = 'refund_owed'
      patch.reconcile_note = `$${refundAmount.toFixed(2)} owed for sold-out ${removedNames.join(', ')} — paid by ${order.payment_method ?? 'unknown'}, which has no automatic refund here. Refund by hand.`
    }
    const { error: moneyErr } = await svc.from('dd_orders').update(patch).eq('id', id)
    // Checked, not ignored. Silently swallowing this is how the totals came
    // out unchanged while the response reported a refund.
    if (moneyErr) {
      console.error('[pos/accept] money update failed for', id, moneyErr.message)
      return NextResponse.json(
        { error: `The refund went through but the order could not be updated: ${moneyErr.message}. Check this order before it leaves.` },
        { status: 500 },
      )
    }
    if (manualRefundOwed) {
      try {
        await notifyAdmins(
          `REFUND OWED $${refundAmount.toFixed(2)} on #${order.short_code ?? id.slice(0, 8)} — sold out ${removedNames.join(', ')}, paid by ${order.payment_method}. No automatic refund for that method; send it by hand.`,
          `Manual refund owed: $${refundAmount.toFixed(2)}`,
        )
      } catch { /* an alert is not worth failing the sale over */ }
    }
  }

  const { error: statusErr } = await svc.from('dd_orders')
    .update({ status: 'confirmed', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (statusErr) return NextResponse.json({ error: statusErr.message }, { status: 500 })

  // ── The customer's chance to refuse ──
  //
  // The substitution is already applied and the kitchen is already making it:
  // 12 of 15 online orders are ASAP, so holding one for ten minutes waiting
  // on a text would stall the counter for an answer that often never comes.
  // Silence is the yes. This row exists only so a refusal arriving in time
  // knows what to undo and what it is worth.
  const OFFER_MINUTES = 10
  let offeredRefundTotal = 0
  if (resolvedSubs.length > 0 && order.customer_phone) {
    const expiresAt = new Date(Date.now() + OFFER_MINUTES * 60_000).toISOString()
    const feeMultiplier = oldSubtotal > 0
      ? 1 + (Number(order.tax || 0) + Number(order.service_fee || 0)) / oldSubtotal
      : 1
    const rows = resolvedSubs.map((r) => {
      const linePaid = round((r.cheaperBy > 0 ? r.newPrice : r.oldPrice) * Number(byId.get(r.itemId)!.quantity))
      const refundIfRefused = round(linePaid * feeMultiplier)
      offeredRefundTotal = round(offeredRefundTotal + refundIfRefused)
      return {
        order_id: id,
        order_item_id: r.itemId,
        original_name: byId.get(r.itemId)!.name,
        replacement_name: r.replacementName,
        // What refusing is worth NOW, not re-derived later against an order
        // that has since been changed by something else.
        refund_amount: refundIfRefused,
        customer_phone: toE164(order.customer_phone),
        expires_at: expiresAt,
      }
    })
    const { error: offerErr } = await svc.from('dd_substitution_offers').insert(rows)
    if (offerErr) {
      // Not worth failing an accepted order over. But the invitation to
      // refuse must then NOT go out: promising a ten-minute window that
      // nothing recorded is worse than never offering one, because the
      // customer's "no" would vanish into the driver-forwarding path.
      // (Also the state before supabase/substitution-offers.sql is run.)
      console.error('[pos/accept] could not record substitution offer for', id, offerErr.message)
      offeredRefundTotal = 0
    }
  }

  // ── Tell the customer ──
  //
  // They paid for something they are not getting. Finding that out at the
  // door, or from a bank statement, is how a shop loses someone over four
  // dollars. Never the reason an accept fails.
  if (changes.length > 0) {
    try {
      const to = toE164(order.customer_phone)
      if (to) {
        const bits: string[] = []
        if (removedNames.length) {
          bits.push(`we were out of ${removedNames.join(', ')} so we removed ${removedNames.length === 1 ? 'it' : 'them'} and refunded $${refundAmount.toFixed(2)}`)
        }
        if (resolvedSubs.length) {
          const what = resolvedSubs
            .map((r) => `${byId.get(r.itemId)!.name} → ${r.replacementName}`)
            .join(', ')
          bits.push(`we were out of ${resolvedSubs.length === 1 ? 'an item' : 'some items'} and sent ${what} instead`)
        }
        // The refusal line only goes out when there is actually an open offer
        // to refuse — promising a reply window we did not record would be
        // worse than not offering one.
        const canRefuse = resolvedSubs.length > 0 && offeredRefundTotal > 0
        const tail = canRefuse
          ? ` If you'd rather not have ${resolvedSubs.length === 1 ? 'it' : 'them'}, reply NO within ${OFFER_MINUTES} minutes and we'll refund $${offeredRefundTotal.toFixed(2)}.`
          : ''
        await sendSMS(to, `Your order #${order.short_code ?? ''} is confirmed — ${bits.join(', and ')}.${tail}`)
      }
    } catch (e) {
      console.error('[pos/accept] customer notice failed for', id, e)
    }
  }

  return NextResponse.json({
    ok: true,
    removed: removedNames,
    substituted: subs.length,
    substitutionRefund: round(substitutionRefund + subTax + subServiceFee),
    refundAmount,
    refunded,
    manualRefundOwed,
  })
}
