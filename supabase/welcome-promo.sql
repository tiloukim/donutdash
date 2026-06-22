-- ============================================================
-- Welcome promo — platform-wide first-order discount for new customers.
--
-- No new table: config lives in the existing dd_platform_settings (key/value)
-- and is edited from /admin/settings. lib/promo.ts reads these keys and is the
-- single source of truth for eligibility + amount at checkout, so the discount
-- is always recomputed server-side from the real subtotal.
--
-- Run in the Supabase SQL editor. Seeds sensible defaults (DISABLED) without
-- clobbering any values an admin has already saved.
-- ============================================================

insert into dd_platform_settings (key, value)
values
  ('welcome_promo_enabled', 'false'),       -- 'true' to turn the offer on
  ('welcome_promo_type', 'percent'),        -- 'percent' | 'amount'
  ('welcome_promo_value', '10'),            -- percent (0-100) or flat dollars
  ('welcome_promo_code', 'WELCOME'),        -- shown to customers; blank = code optional
  ('welcome_promo_max_discount', '0')       -- $ cap for the percent type (0 = no cap)
on conflict (key) do nothing;
