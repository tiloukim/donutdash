-- ============================================================
-- Per-shop POS entitlement.
--
-- `pos_enabled` controls whether a shop may use the in-store POS app,
-- SEPARATELY from `is_active` (the master delivery + account switch). This
-- lets you sell POS as its own product: a shop can be live on delivery but
-- have POS off, or vice-versa.
--
-- Enforced server-side in lib/pos-shop-auth.ts (authorizeForShop): a shop
-- with pos_enabled = false gets 403 on POS routes (orders, payments, …).
-- Toggled from /admin/shops ("Disable POS" / "Enable POS").
--
-- Defaults to true so every existing shop keeps working. The POS auth code
-- tolerates this column being absent (treats POS as enabled) until this runs,
-- so deploy order doesn't matter — but run it to make the toggle effective.
-- ============================================================

alter table dd_shops
  add column if not exists pos_enabled boolean not null default true;
