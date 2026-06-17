-- ============================================================
-- POS local menu + DonutDash delivery opt-in
--
-- Run in Supabase SQL editor.
--
-- After this migration:
--   - dd_menu_items has per-channel price + availability so each item
--     can have a POS price and a (potentially different) online price,
--     and be hidden from one channel without affecting the other.
--   - dd_shops has delivery_enabled. Default for NEW shops is false
--     (POS-only); existing shops are backfilled to true so the current
--     marketplace shops (Top Donuts) keep working unchanged.
--   - Legacy 'price' and 'is_available' columns are KEPT for backwards
--     compatibility. Callers should be migrated to read the channel
--     fields, but old code continues to function.
-- ============================================================

-- 1. dd_menu_items: per-channel price + visibility
alter table dd_menu_items
  add column if not exists pos_price numeric(8,2);
alter table dd_menu_items
  add column if not exists online_price numeric(8,2);
alter table dd_menu_items
  add column if not exists available_for_pos boolean not null default true;
alter table dd_menu_items
  add column if not exists available_for_online boolean not null default true;

-- 2. Backfill existing rows: both channel prices start at the legacy
--    price; both availability flags start at is_available.
update dd_menu_items
set
  pos_price = coalesce(pos_price, price),
  online_price = coalesce(online_price, price),
  available_for_pos = case when available_for_pos is null then is_available else available_for_pos end,
  available_for_online = case when available_for_online is null then is_available else available_for_online end;

-- 3. dd_shops: delivery opt-in
--    Default false (POS-only for new signups). Backfill every existing
--    shop to true since they were all marketplace shops before this
--    column existed.
alter table dd_shops
  add column if not exists delivery_enabled boolean not null default false;
update dd_shops set delivery_enabled = true;
