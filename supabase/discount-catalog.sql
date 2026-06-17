-- ============================================================
-- Discount catalog for the POS — Square-style "Create a discount"
-- flow. Owner saves discounts (10% off, Senior, Employee, etc.) and
-- cashiers pick from the list at checkout instead of typing each time.
--
-- Run in Supabase SQL editor.
--
-- RLS intentionally NOT enabled here — POS reads/writes go through
-- the same anon-key + Bearer-token pattern as dd_menu_items and
-- dd_orders. A future migration will add dd_shop_staff + RLS.
-- ============================================================

create table if not exists dd_discounts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references dd_shops(id) on delete cascade,

  -- Display name surfaced in the picker and printed on the receipt.
  name text not null,

  -- 'percent' multiplies by value/100 against the subtotal; 'amount'
  -- subtracts a flat dollar amount. Subtotal floors at 0 either way.
  type text not null check (type in ('percent', 'amount')),

  -- Percent: 0-100. Amount: dollars (e.g. 5.00 = $5 off).
  value numeric(10,2) not null check (value >= 0),

  -- Manager/owner approval gate. POS will prompt for passcode before
  -- applying when true. Default false so owner discounts apply silently.
  require_passcode boolean not null default false,

  -- false (default) → subtotal − discount → tax (standard).
  -- true  → subtotal → tax → final − discount (mfr rebates / instant savings).
  apply_after_taxes boolean not null default false,

  -- Manual ordering inside the picker. Lower = higher in the list.
  sort_order int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dd_discounts_shop_sort
  on dd_discounts(shop_id, sort_order, created_at);

-- Supabase enables RLS on new tables by default. Match the dd_orders
-- pattern (RLS off) so POS direct inserts/selects work.
alter table dd_discounts disable row level security;

-- ============================================================
-- dd_orders: persist the discount label + amount that was applied
-- at checkout so reports + admin views can reflect it. Discount
-- already lives in the cashier's receipt; this lets the platform
-- track it too.
-- ============================================================

alter table dd_orders
  add column if not exists discount_label text,
  add column if not exists discount_amount numeric(10,2) not null default 0;
