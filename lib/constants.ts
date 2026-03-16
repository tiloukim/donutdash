export const SERVICE_FEE_RATE = 0.15

export const DEFAULT_DELIVERY_FEE = 3.99

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
