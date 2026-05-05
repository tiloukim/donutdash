-- Per-shop commission rate
--
-- Adds dd_shops.commission_pct so admin can grant exception rates (15-30%)
-- to specific shops, with default 20%.
--
-- Adds dd_orders.commission_pct so historical orders are frozen at the rate
-- in effect when the order was placed. Otherwise changing a shop's rate
-- would rewrite past earnings reports.
--
-- Run in Supabase SQL editor.

alter table public.dd_shops
  add column if not exists commission_pct numeric(5,2) not null default 20.00;

alter table public.dd_shops
  drop constraint if exists dd_shops_commission_pct_floor;
alter table public.dd_shops
  add constraint dd_shops_commission_pct_floor check (commission_pct >= 15.00);

alter table public.dd_shops
  drop constraint if exists dd_shops_commission_pct_ceiling;
alter table public.dd_shops
  add constraint dd_shops_commission_pct_ceiling check (commission_pct <= 30.00);

comment on column public.dd_shops.commission_pct is
  'Per-shop commission percentage taken from food subtotal. Default 20%, floor 15%, ceiling 30%. Custom rates below 20% require admin approval and a written addendum to the merchant agreement.';

alter table public.dd_orders
  add column if not exists commission_pct numeric(5,2);

comment on column public.dd_orders.commission_pct is
  'Snapshot of dd_shops.commission_pct at the moment of checkout. Frozen so historical earnings do not shift when a shop''s rate is updated.';
