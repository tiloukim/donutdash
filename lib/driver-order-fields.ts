/**
 * The order columns a driver may see.
 *
 * Every driver-facing route used to select `dd_orders(*)`. dd_orders has 50
 * columns, so drivers were handed card_fingerprint, card_auth_code,
 * card_last4, card_ref_number, payment_id, checkout_key, customer_email,
 * commission_pct and promo_code along with the address they were driving to.
 * None of that is needed to carry an order to a door, and card data has no
 * business leaving the payment path.
 *
 * `as const` matters: supabase-js parses the select string at the *type*
 * level, and a plain `string` widens the interpolation to `${string}`, which
 * it can't parse — the joined row silently collapses to a ParserError. A
 * literal type interpolates cleanly.
 *
 * Anything added here is something a driver can read. Add deliberately.
 */
export const DRIVER_ORDER_FIELDS =
  'id, short_code, status, order_type, fulfillment_type, scheduled_for, created_at, source, subtotal, tax, tip, total, delivery_fee, service_fee, small_order_fee, delivery_address, delivery_city, delivery_lat, delivery_lng, delivery_instructions, customer_name, customer_phone, customer_id, shop_id, payment_method' as const

/**
 * The narrower set for orders a driver hasn't taken yet — the offer popup and
 * the Available Deliveries pool.
 *
 * `/api/driver/available` is readable by every online driver, so anything
 * here leaks to drivers with no connection to the order. They need to judge
 * the run — where it starts, where it ends, what it pays — not who placed it.
 * The customer's name and phone are deliberately absent; they arrive with the
 * delivery once it's accepted.
 */
export const DRIVER_OFFER_ORDER_FIELDS =
  'id, short_code, status, order_type, scheduled_for, created_at, subtotal, tip, total, delivery_address, delivery_city, delivery_lat, delivery_lng, delivery_instructions, shop_id, payment_method' as const
