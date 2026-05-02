export const SERVICE_FEE_RATE = 0.10

export const SHOP_COMMISSION_RATE = 0.20

export const DEFAULT_DELIVERY_FEE = 3.99

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
export const MAX_DRIVER_DISTANCE_MILES = 10
export const MAX_DELIVERY_MILES = 3
export const BASE_DELIVERY_PAY = 2.50
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
