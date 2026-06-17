-- ============================================================
-- Hotfix for the discount-catalog migration.
--
-- Supabase enables RLS on new tables by default. The original
-- discount-catalog.sql had a comment saying "RLS intentionally
-- NOT enabled here" but never actually issued the disable
-- statement, so inserts from the POS hit:
--   "new row violates row-level security policy for table dd_discounts"
--
-- Disabling RLS matches dd_orders / dd_menu_items today. When we
-- add dd_shop_staff + real RLS policies in a future migration,
-- this gets re-enabled with proper INSERT/UPDATE/SELECT rules.
--
-- Run in Supabase SQL editor.
-- ============================================================

alter table dd_discounts disable row level security;
