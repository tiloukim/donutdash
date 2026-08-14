// Pay / fee constants below are FALLBACK DEFAULTS — the runtime
// values flow through getPayConfig() in lib/pay-config.ts, which
// reads dd_platform_settings (admin Settings page). New code should
// import the helper, not these constants.
//   - service_fee_rate    -> SERVICE_FEE_RATE
//   - default_delivery_fee -> DEFAULT_DELIVERY_FEE
//   - driver_base_pay     -> BASE_DELIVERY_PAY
//   - driver_per_mile     -> PER_MILE_PAY
//   - shop_commission_rate -> SHOP_COMMISSION_RATE
//   - min_order_amount    -> MIN_ORDER_AMOUNT
// Per-delivery base_pay is snapshotted to dd_deliveries.base_pay at
// creation, so historical payouts always honor the quote.
export const SERVICE_FEE_RATE = 0.10

export const SHOP_COMMISSION_RATE = 0.20
// Bounds for per-shop commission rate (admin can grant lower rates as exceptions).
export const MIN_COMMISSION_RATE = 0.15
export const MAX_COMMISSION_RATE = 0.30

// Resolve the commission rate (as a fraction, e.g. 0.20) for an order or shop.
// Order takes precedence (snapshot at checkout time), then current shop rate,
// then the system-wide default. Accepts numbers as percent (20 → 0.20).
export function resolveCommissionRate(input: { commission_pct?: number | null } | null | undefined): number {
  const pct = input?.commission_pct
  if (pct == null) return SHOP_COMMISSION_RATE
  return Number(pct) / 100
}

export const DEFAULT_DELIVERY_FEE = 3.99

// Flat fee DonutDash bills the SHOP OWNER for each in-store POS card
// transaction (not charged to the customer — separate from cash discount).
// Logged per card sale in dd_pos_card_fees and summed in the shop's report.
export const POS_CARD_TRANSACTION_FEE = 0.15

// Distance-based pricing: shops charge a base fee that covers the first
// BASE_DELIVERY_RADIUS_MILES of driving, then PER_EXTRA_MILE_FEE per mile after.
// Driver is paid per mile of one-way distance (PER_MILE_PAY); the gap between
// PER_EXTRA_MILE_FEE and PER_MILE_PAY is platform margin on each extra mile.
export const BASE_DELIVERY_RADIUS_MILES = 1
export const PER_EXTRA_MILE_FEE = 1.50

export const MIN_ORDER_AMOUNT = 10

export const SMALL_ORDER_FEE = 1.99

export const TIP_OPTIONS = [2, 3, 4, 5]

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'picked_up',
  'delivering',
  'delivered',
  'cancelled',
] as const

export const DELIVERY_STATUSES = [
  'assigned',
  'heading_to_shop',
  'at_shop',
  'picked_up',
  'delivering',
  'delivered',
  'cancelled',
] as const

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready_for_pickup: 'Ready for Pickup',
  picked_up: 'Picked Up',
  delivering: 'On the Way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  assigned: 'Assigned',
  heading_to_shop: 'Heading to Shop',
  at_shop: 'At Shop',
  picked_up: 'Picked Up',
  delivering: 'Delivering',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

// Delivery logistics
export const OFFER_TIMEOUT_SECONDS = 45
// How long a driver's last GPS ping can be stale before we treat them as
// gone. Used BOTH by dispatch (skip stale drivers when offering) and by the
// offline-stale-drivers cron (flip is_online=false). Keeping them equal means
// any driver shown "online" is also dispatch-eligible — otherwise a driver
// with a few throttled pings stays "online" but silently receives no offers.
export const DRIVER_STALE_MS = 5 * 60 * 1000
export const MAX_DRIVER_DISTANCE_MILES = 7
export const MAX_DELIVERY_MILES = 3
export const BASE_DELIVERY_PAY = 3.00
export const PER_MILE_PAY = 0.75
export const DRIVER_LOCATION_UPDATE_INTERVAL = 10000

// Surge pricing
export const SURGE_THRESHOLD_ORDERS = 5   // Active orders in last hour to trigger surge
export const SURGE_MULTIPLIER = 1.5       // Delivery fee multiplier during surge

// Shop busy status
export const SHOP_BUSY_THRESHOLD = 3      // Active orders per shop to mark as busy

// ETA estimation
export const AVERAGE_PREP_TIME_MINUTES = 15  // Average time for shop to prepare order
export const AVERAGE_SPEED_MPH = 25          // Average driving speed in city
