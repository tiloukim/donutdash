-- ============================================================
-- POS Business Toolkit migration — Customers, Staff, Inventory, Banking
--
-- Run in Supabase SQL editor for project hcufceeowohfzhndktne.
--
-- RLS is intentionally NOT enabled (matches dd_orders + dd_menu_items).
-- POS direct reads/writes go through anon key + Bearer-token validation.
-- ============================================================

-- ============================================================
-- STAFF — clock-in / clock-out timestamps tracked per shift.
-- One row per shift. clock_out is null while the shift is open.
-- ============================================================

create table if not exists dd_shifts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references dd_shops(id) on delete cascade,
  user_id uuid not null references dd_users(id),

  clock_in  timestamptz not null default now(),
  clock_out timestamptz,

  -- Optional cashier notes about the shift (issues, swaps, etc.).
  notes text,

  created_at timestamptz not null default now()
);

create index if not exists idx_dd_shifts_shop_open
  on dd_shifts(shop_id, clock_in desc)
  where clock_out is null;

create index if not exists idx_dd_shifts_user
  on dd_shifts(user_id, clock_in desc);

alter table dd_shifts disable row level security;

-- ============================================================
-- BANKING — cash drawer sessions.
-- One row per drawer open. expected = opening_count + cash_sales − refunds.
-- over_short = closing_count − expected (positive = over, negative = short).
-- ============================================================

create table if not exists dd_drawer_sessions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references dd_shops(id) on delete cascade,
  opened_by uuid not null references dd_users(id),

  opened_at      timestamptz not null default now(),
  opening_count  numeric(10,2) not null check (opening_count >= 0),

  closed_at      timestamptz,
  closed_by      uuid references dd_users(id),
  closing_count  numeric(10,2) check (closing_count >= 0),

  -- Recomputed on close from cash-sale totals between opened_at and
  -- closed_at. Stored so reports can show drawer history without
  -- re-aggregating dd_orders every time.
  expected_cash  numeric(10,2),
  over_short     numeric(10,2),

  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_dd_drawer_sessions_shop_open
  on dd_drawer_sessions(shop_id, opened_at desc)
  where closed_at is null;

create index if not exists idx_dd_drawer_sessions_shop_history
  on dd_drawer_sessions(shop_id, opened_at desc);

alter table dd_drawer_sessions disable row level security;

-- ============================================================
-- INVENTORY — per-item stock count.
-- Add a nullable column so existing items default to "untracked"
-- (null = inventory not tracked; show no badge). Tracked items
-- with stock_count = 0 render an Out of stock badge in the POS grid.
-- ============================================================

alter table dd_menu_items
  add column if not exists stock_count integer;

alter table dd_menu_items
  add column if not exists low_stock_threshold integer not null default 5;

create index if not exists idx_dd_menu_items_stock
  on dd_menu_items(shop_id, stock_count)
  where stock_count is not null;
