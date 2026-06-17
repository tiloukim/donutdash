-- ============================================================
-- POS extensions — supports walk-in counter sales from the
-- DonutDash POS app (~/donutdash-pos) alongside existing
-- delivery + pickup orders.
--
-- Run in Supabase SQL editor.
--
-- Phase 1: column additions + short_code generator only.
-- RLS is intentionally NOT enabled here — POS writes go through
-- service-role API routes (app/api/pos/*), matching how drivers
-- and the customer order flow work today. A future migration will
-- add a real dd_shop_staff table + RLS for direct device access.
-- ============================================================

-- 1. dd_orders: allow walk-in sales that have no customer or address
alter table dd_orders alter column customer_id drop not null;
alter table dd_orders alter column delivery_address drop not null;
alter table dd_orders alter column delivery_city drop not null;

-- 2. dd_orders: classify and tag the source
alter table dd_orders add column if not exists order_type text not null default 'delivery'
  check (order_type in ('delivery', 'pickup', 'pos_walkin'));
alter table dd_orders add column if not exists source text;
alter table dd_orders add column if not exists short_code text;
alter table dd_orders add column if not exists tax numeric(8,2) not null default 0;
alter table dd_orders add column if not exists cash_received numeric(10,2);
alter table dd_orders add column if not exists change_given numeric(10,2);
alter table dd_orders add column if not exists staff_id uuid references dd_users(id);

create index if not exists idx_dd_orders_type on dd_orders(order_type);
create index if not exists idx_dd_orders_shop_created on dd_orders(shop_id, created_at desc);

-- 3. short_code generator for human-readable order numbers (POS + delivery share)
create or replace function dd_generate_short_code() returns text language plpgsql as $$
declare
  code text;
begin
  code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 5));
  return code;
end;
$$;

create or replace function dd_orders_set_short_code() returns trigger language plpgsql as $$
begin
  if new.short_code is null then
    new.short_code := dd_generate_short_code();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_dd_orders_short_code on dd_orders;
create trigger trg_dd_orders_short_code before insert on dd_orders
  for each row execute function dd_orders_set_short_code();
