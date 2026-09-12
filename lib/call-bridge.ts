import { randomBytes } from 'node:crypto'

export type CallParty = 'customer' | 'driver' | 'shop' | 'admin'

/** How long after delivery a party can still call about the order. Complaints
 *  about a drop-off happen in the minutes after it, not the next morning. */
const POST_DELIVERY_GRACE_MS = 60 * 60 * 1000

const LIVE_STATUSES = ['confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'delivering']

export interface OrderParties {
  orderId: string
  deliveryId: string | null
  status: string
  deliveredAt: string | null
  customer: { userId: string | null; phone: string | null; name: string | null }
  driver: { userId: string | null; phone: string | null; name: string | null }
  shop: { ownerId: string | null; phone: string | null; name: string | null }
}

/**
 * Resolve every party on an order, with their real numbers.
 *
 * Server-side only — the return value must never reach a client. It exists so
 * the bridge can dial without anyone downstream knowing what it dialed.
 */
export async function loadOrderParties(svc: any, orderId: string): Promise<OrderParties | null> {
  const { data: order } = await svc
    .from('dd_orders')
    .select('id, status, customer_id, customer_phone, customer_name, shop_id')
    .eq('id', orderId)
    .maybeSingle()
  if (!order) return null

  const [{ data: shop }, { data: customer }, { data: deliveryRows }] = await Promise.all([
    svc.from('dd_shops').select('id, name, phone, owner_id').eq('id', order.shop_id).maybeSingle(),
    order.customer_id
      ? svc.from('dd_users').select('id, name, phone').eq('id', order.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
    // Newest non-cancelled delivery, not maybeSingle(): an order that was
    // reassigned after a cancellation has more than one row, and maybeSingle
    // throws on that rather than picking the live one.
    svc
      .from('dd_deliveries')
      .select('id, driver_id, driver_name, driver_phone, delivered_at')
      .eq('order_id', orderId)
      .not('status', 'eq', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1),
  ])
  const delivery = Array.isArray(deliveryRows) ? deliveryRows[0] : deliveryRows

  // The driver's profile number is the live one; driver_phone on the delivery
  // is a snapshot taken at assignment and can be stale.
  let driverPhone: string | null = delivery?.driver_phone ?? null
  let driverName: string | null = delivery?.driver_name ?? null
  if (delivery?.driver_id) {
    const { data: driverUser } = await svc
      .from('dd_users')
      .select('name, phone')
      .eq('id', delivery.driver_id)
      .maybeSingle()
    if (driverUser?.phone) driverPhone = driverUser.phone
    if (driverUser?.name) driverName = driverUser.name
  }

  return {
    orderId: order.id,
    deliveryId: delivery?.id ?? null,
    status: order.status,
    deliveredAt: delivery?.delivered_at ?? null,
    // customer_phone is what they typed at checkout and may differ from the
    // number on their profile — prefer it, it's the one they expect a call on.
    customer: {
      userId: order.customer_id ?? null,
      phone: order.customer_phone || customer?.phone || null,
      name: order.customer_name || customer?.name || null,
    },
    driver: { userId: delivery?.driver_id ?? null, phone: driverPhone, name: driverName },
    shop: { ownerId: shop?.owner_id ?? null, phone: shop?.phone ?? null, name: shop?.name ?? null },
  }
}

/**
 * Which party is this user on this order, if any?
 *
 * Being an admin is checked by the caller; this answers the relationship
 * question only. A user with no relationship gets null and no call.
 */
export function partyForUser(
  parties: OrderParties,
  userId: string,
  role: string,
): CallParty | null {
  if (parties.driver.userId && parties.driver.userId === userId) return 'driver'
  if (parties.shop.ownerId && parties.shop.ownerId === userId) return 'shop'
  if (parties.customer.userId && parties.customer.userId === userId) return 'customer'
  // Platform staff can reach any party on any order for support.
  if (['admin', 'general_manager', 'field_manager'].includes(role)) return 'admin'
  return null
}

/** The order has to still be live for a bridge to be justified. */
export function callWindowOpen(parties: OrderParties): boolean {
  if (LIVE_STATUSES.includes(parties.status)) return true
  if (parties.status === 'delivered' && parties.deliveredAt) {
    return Date.now() - new Date(parties.deliveredAt).getTime() < POST_DELIVERY_GRACE_MS
  }
  return false
}

export function phoneForParty(parties: OrderParties, party: CallParty): string | null {
  if (party === 'customer') return parties.customer.phone
  if (party === 'driver') return parties.driver.phone
  if (party === 'shop') return parties.shop.phone
  return null
}

/** What the answering party hears, so they know why their phone rang. */
export function describeParty(parties: OrderParties, party: CallParty): string {
  if (party === 'customer') return 'your customer'
  if (party === 'driver') return 'your DonutDash driver'
  if (party === 'shop') return parties.shop.name || 'the shop'
  return 'DonutDash support'
}

/** 32 bytes of URL-safe randomness. The TeXML webhook is unauthenticated, so
 *  this token is the only thing guarding a free bridge to a real number. */
export function newCallToken(): string {
  return randomBytes(24).toString('base64url')
}
