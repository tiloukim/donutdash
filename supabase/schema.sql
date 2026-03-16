-- DonutDash Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- USERS
-- ============================================================
create table dd_users (
  id uuid primary key default uuid_generate_v4(),
  auth_id uuid unique not null,
  email text unique not null,
  name text not null,
  phone text,
  role text not null default 'customer' check (role in ('customer', 'shop_owner', 'driver', 'admin')),
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_dd_users_auth_id on dd_users(auth_id);
create index idx_dd_users_role on dd_users(role);

-- ============================================================
-- SHOPS
-- ============================================================
create table dd_shops (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references dd_users(id) on delete cascade,
  name text not null,
  slug text unique not null,
  description text,
  image_url text,
  banner_url text,
  address text not null,
  city text not null,
  state text not null default 'CA',
  zip text not null,
  lat double precision,
  lng double precision,
  phone text,
  rating numeric(2,1) not null default 0,
  review_count integer not null default 0,
  delivery_fee numeric(6,2) not null default 3.99,
  min_order numeric(6,2) not null default 10,
  service_fee_pct numeric(4,2) not null default 15,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_dd_shops_slug on dd_shops(slug);
create index idx_dd_shops_owner on dd_shops(owner_id);
create index idx_dd_shops_city on dd_shops(city);

-- ============================================================
-- MENU ITEMS
-- ============================================================
create table dd_menu_items (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid not null references dd_shops(id) on delete cascade,
  name text not null,
  description text,
  price numeric(8,2) not null,
  image_url text,
  category text not null default 'donuts' check (category in ('donuts', 'coffee', 'breakfast', 'drinks', 'other')),
  is_available boolean not null default true,
  is_featured boolean not null default false,
  sort_order integer not null default 0
);

create index idx_dd_menu_items_shop on dd_menu_items(shop_id);
create index idx_dd_menu_items_category on dd_menu_items(category);

-- ============================================================
-- ORDERS
-- ============================================================
create table dd_orders (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references dd_users(id) on delete cascade,
  shop_id uuid not null references dd_shops(id) on delete cascade,
  status text not null default 'pending' check (status in (
    'pending', 'confirmed', 'preparing', 'ready_for_pickup',
    'picked_up', 'delivering', 'delivered', 'cancelled'
  )),
  subtotal numeric(10,2) not null,
  delivery_fee numeric(6,2) not null default 0,
  service_fee numeric(6,2) not null default 0,
  tip numeric(6,2) not null default 0,
  total numeric(10,2) not null,
  payment_method text,
  payment_id text,
  delivery_address text not null,
  delivery_city text not null,
  delivery_lat double precision,
  delivery_lng double precision,
  delivery_instructions text,
  estimated_delivery_time timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_dd_orders_customer on dd_orders(customer_id);
create index idx_dd_orders_shop on dd_orders(shop_id);
create index idx_dd_orders_status on dd_orders(status);

-- ============================================================
-- ORDER ITEMS
-- ============================================================
create table dd_order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references dd_orders(id) on delete cascade,
  menu_item_id uuid not null references dd_menu_items(id),
  name text not null,
  price numeric(8,2) not null,
  quantity integer not null default 1,
  special_instructions text,
  image_url text
);

create index idx_dd_order_items_order on dd_order_items(order_id);

-- ============================================================
-- DELIVERIES
-- ============================================================
create table dd_deliveries (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid unique not null references dd_orders(id) on delete cascade,
  driver_id uuid not null references dd_users(id),
  status text not null default 'assigned' check (status in (
    'assigned', 'heading_to_shop', 'at_shop', 'picked_up',
    'delivering', 'delivered', 'cancelled'
  )),
  pickup_lat double precision,
  pickup_lng double precision,
  dropoff_lat double precision,
  dropoff_lng double precision,
  distance_miles numeric(6,2),
  driver_earnings numeric(8,2),
  picked_up_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_dd_deliveries_order on dd_deliveries(order_id);
create index idx_dd_deliveries_driver on dd_deliveries(driver_id);
create index idx_dd_deliveries_status on dd_deliveries(status);

-- ============================================================
-- ADDRESSES
-- ============================================================
create table dd_addresses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references dd_users(id) on delete cascade,
  label text not null default 'Home',
  address text not null,
  city text not null,
  state text not null default 'CA',
  zip text not null,
  lat double precision,
  lng double precision,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_dd_addresses_user on dd_addresses(user_id);

-- ============================================================
-- BUSINESS HOURS
-- ============================================================
create table dd_business_hours (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid not null references dd_shops(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  open_time time not null default '06:00',
  close_time time not null default '18:00',
  is_closed boolean not null default false,
  unique (shop_id, day_of_week)
);

create index idx_dd_business_hours_shop on dd_business_hours(shop_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create table dd_notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references dd_users(id) on delete cascade,
  title text not null,
  body text not null,
  type text not null default 'info' check (type in ('info', 'order', 'delivery', 'promo')),
  is_read boolean not null default false,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index idx_dd_notifications_user on dd_notifications(user_id);
create index idx_dd_notifications_unread on dd_notifications(user_id) where is_read = false;

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_dd_orders_updated_at
  before update on dd_orders
  for each row execute function update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
alter table dd_users enable row level security;
alter table dd_shops enable row level security;
alter table dd_menu_items enable row level security;
alter table dd_orders enable row level security;
alter table dd_order_items enable row level security;
alter table dd_deliveries enable row level security;
alter table dd_addresses enable row level security;
alter table dd_business_hours enable row level security;
alter table dd_notifications enable row level security;

-- USERS policies
create policy "Users can read own profile"
  on dd_users for select
  using (auth.uid() = auth_id);

create policy "Users can update own profile"
  on dd_users for update
  using (auth.uid() = auth_id);

create policy "Service role can manage all users"
  on dd_users for all
  using (auth.jwt() ->> 'role' = 'service_role');

-- SHOPS policies
create policy "Anyone can view active shops"
  on dd_shops for select
  using (is_active = true);

create policy "Shop owners can manage own shops"
  on dd_shops for all
  using (
    owner_id in (
      select id from dd_users where auth_id = auth.uid()
    )
  );

-- MENU ITEMS policies
create policy "Anyone can view available menu items"
  on dd_menu_items for select
  using (is_available = true);

create policy "Shop owners can manage own menu items"
  on dd_menu_items for all
  using (
    shop_id in (
      select id from dd_shops where owner_id in (
        select id from dd_users where auth_id = auth.uid()
      )
    )
  );

-- ORDERS policies
create policy "Customers can view own orders"
  on dd_orders for select
  using (
    customer_id in (
      select id from dd_users where auth_id = auth.uid()
    )
  );

create policy "Customers can create orders"
  on dd_orders for insert
  with check (
    customer_id in (
      select id from dd_users where auth_id = auth.uid()
    )
  );

create policy "Shop owners can view orders for their shops"
  on dd_orders for select
  using (
    shop_id in (
      select id from dd_shops where owner_id in (
        select id from dd_users where auth_id = auth.uid()
      )
    )
  );

create policy "Shop owners can update orders for their shops"
  on dd_orders for update
  using (
    shop_id in (
      select id from dd_shops where owner_id in (
        select id from dd_users where auth_id = auth.uid()
      )
    )
  );

-- ORDER ITEMS policies
create policy "Users can view own order items"
  on dd_order_items for select
  using (
    order_id in (
      select id from dd_orders where customer_id in (
        select id from dd_users where auth_id = auth.uid()
      )
    )
  );

create policy "Users can insert own order items"
  on dd_order_items for insert
  with check (
    order_id in (
      select id from dd_orders where customer_id in (
        select id from dd_users where auth_id = auth.uid()
      )
    )
  );

create policy "Shop owners can view order items for their shops"
  on dd_order_items for select
  using (
    order_id in (
      select id from dd_orders where shop_id in (
        select id from dd_shops where owner_id in (
          select id from dd_users where auth_id = auth.uid()
        )
      )
    )
  );

-- DELIVERIES policies
create policy "Drivers can view assigned deliveries"
  on dd_deliveries for select
  using (
    driver_id in (
      select id from dd_users where auth_id = auth.uid()
    )
  );

create policy "Drivers can update assigned deliveries"
  on dd_deliveries for update
  using (
    driver_id in (
      select id from dd_users where auth_id = auth.uid()
    )
  );

create policy "Customers can view own deliveries"
  on dd_deliveries for select
  using (
    order_id in (
      select id from dd_orders where customer_id in (
        select id from dd_users where auth_id = auth.uid()
      )
    )
  );

-- ADDRESSES policies
create policy "Users can manage own addresses"
  on dd_addresses for all
  using (
    user_id in (
      select id from dd_users where auth_id = auth.uid()
    )
  );

-- BUSINESS HOURS policies
create policy "Anyone can view business hours"
  on dd_business_hours for select
  using (true);

create policy "Shop owners can manage own business hours"
  on dd_business_hours for all
  using (
    shop_id in (
      select id from dd_shops where owner_id in (
        select id from dd_users where auth_id = auth.uid()
      )
    )
  );

-- NOTIFICATIONS policies
create policy "Users can view own notifications"
  on dd_notifications for select
  using (
    user_id in (
      select id from dd_users where auth_id = auth.uid()
    )
  );

create policy "Users can update own notifications"
  on dd_notifications for update
  using (
    user_id in (
      select id from dd_users where auth_id = auth.uid()
    )
  );
