export const SERVICE_FEE_RATE = 0.15

// Delivery fee charged to customer (base + per mile)
// Must cover driver pay + admin margin
export const DELIVERY_FEE_BASE = 2.99       // Flat base fee
export const DELIVERY_FEE_PER_MILE = 0.99   // Per mile charge to customer
export const DEFAULT_DELIVERY_FEE = 4.99     // Default when distance unknown

export const MIN_ORDER_AMOUNT = 10

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
export const MAX_DRIVER_DISTANCE_MILES = 10
export const BASE_PICKUP_PAY = 1.50    // Uber Eats: $1.50 per pickup
export const BASE_DROPOFF_PAY = 1.00   // Uber Eats: $1.00 per dropoff
export const BASE_DELIVERY_PAY = 2.50   // Combined base (pickup + dropoff)
export const PER_MILE_PAY = 0.55        // Uber Eats: ~$0.50-$0.60 per mile
export const PER_MINUTE_PAY = 0.12      // Uber Eats: ~$0.10-$0.15 per minute
export const DRIVER_LOCATION_UPDATE_INTERVAL = 10000
