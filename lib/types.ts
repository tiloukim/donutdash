export interface User {
  id: string
  auth_id: string
  email: string
  name: string
  phone: string | null
  role: 'customer' | 'shop_owner' | 'driver' | 'admin'
  avatar_url: string | null
  is_active: boolean
  created_at: string
}

export interface Shop {
  id: string
  owner_id: string
  name: string
  slug: string
  description: string | null
  image_url: string | null
  banner_url: string | null
  address: string
  city: string
  state: string
  zip: string
  lat: number | null
  lng: number | null
  phone: string | null
  rating: number
  review_count: number
  delivery_fee: number
  min_order: number
  service_fee_pct: number
  is_active: boolean
  created_at: string
}

export interface MenuItem {
  id: string
  shop_id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  category: 'donuts' | 'coffee' | 'breakfast' | 'drinks' | 'other'
  is_available: boolean
  is_featured: boolean
  sort_order: number
}

export interface Order {
  id: string
  customer_id: string
  shop_id: string
  status:
    | 'pending'
    | 'confirmed'
    | 'preparing'
    | 'ready_for_pickup'
    | 'picked_up'
    | 'delivering'
    | 'delivered'
    | 'cancelled'
  subtotal: number
  delivery_fee: number
  service_fee: number
  tip: number
  total: number
  payment_method: string | null
  payment_id: string | null
  delivery_address: string
  delivery_city: string
  delivery_lat: number | null
  delivery_lng: number | null
  delivery_instructions: string | null
  estimated_delivery_time: string | null
  created_at: string
  updated_at: string
  items?: OrderItem[]
  shop?: Shop
  customer?: User
}

export interface OrderItem {
  id: string
  order_id: string
  menu_item_id: string
  name: string
  price: number
  quantity: number
  special_instructions: string | null
  image_url: string | null
}

export interface Delivery {
  id: string
  order_id: string
  driver_id: string
  status: string
  pickup_lat: number | null
  pickup_lng: number | null
  dropoff_lat: number | null
  dropoff_lng: number | null
  distance_miles: number | null
  driver_earnings: number | null
  picked_up_at: string | null
  delivered_at: string | null
  created_at: string
  order?: Order
}

export interface Address {
  id: string
  user_id: string
  label: string
  address: string
  city: string
  state: string
  zip: string
  lat: number | null
  lng: number | null
  is_default: boolean
  created_at: string
}

export interface BusinessHours {
  id: string
  shop_id: string
  day_of_week: number
  open_time: string
  close_time: string
  is_closed: boolean
}

export interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  image_url: string | null
  special_instructions: string | null
}
