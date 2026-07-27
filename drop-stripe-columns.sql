-- Drop vestigial Stripe Connect columns from dd_shops.
--
-- DonutDash migrated off Stripe onto Square (Stripe account was closed).
-- These two columns are no longer read or written by any code path — all
-- Stripe SELECTs were removed in the teardown PRs. Safe to drop.
--
-- ⚠️  Run this AFTER the code deploy that removes the last stripe_account_id
--     SELECTs is live in production. Dropping while old code is still serving
--     would break /api/shop/orders/[id]/breakdown and the admin payout-trace.

ALTER TABLE dd_shops DROP COLUMN IF EXISTS stripe_account_id;
ALTER TABLE dd_shops DROP COLUMN IF EXISTS stripe_onboarding_complete;
