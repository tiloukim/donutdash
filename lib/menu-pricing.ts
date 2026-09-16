import type { MenuItem, VariantOption } from './types'

// Which price a customer on donutdash.app pays.
//
// dd_menu_items has carried pos_price and online_price for a long time and
// the website read NEITHER — it charged `price` everywhere. So a shop could
// set an online price in the POS menu editor and the site would quietly
// ignore it and charge the counter price instead.
//
// That matters because the two are not meant to match. DonutDash takes a
// commission on online orders, so a shop that prices online the same as the
// counter earns less per donut through the app than through the door. The
// online price is how an owner covers that, and it has to be theirs to set.
//
// `price` stays the fallback everywhere. A shop that has never set an online
// price keeps charging exactly what it charged before — this changes nothing
// until someone sets one.

/** Item-level price for the customer-facing site. */
export function onlineItemPrice(item: Pick<MenuItem, 'price' | 'online_price'>): number {
  const online = item.online_price
  return online != null && online > 0 ? Number(online) : Number(item.price)
}

/** Price of one variant option for the customer-facing site.
 *
 *  Options carry their own `online_price` alongside `price` for the same
 *  reason items do — a dozen sold through the app costs the shop commission
 *  that a dozen over the counter does not, and a percentage markup on a
 *  $13.50 dozen is a very different number from one on a $1.25 single.
 *
 *  Legacy options are plain strings with no price at all, and an option
 *  priced at 0 means "same as the base item" rather than free. */
export function onlineOptionPrice(
  o: VariantOption,
  item: Pick<MenuItem, 'price' | 'online_price'>,
): number {
  if (typeof o === 'string') return onlineItemPrice(item)
  if (o.online_price != null && o.online_price > 0) return Number(o.online_price)
  if (o.price > 0) return Number(o.price)
  return onlineItemPrice(item)
}
