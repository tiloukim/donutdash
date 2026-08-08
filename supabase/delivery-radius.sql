-- Per-shop delivery radius (miles). NULL = fall back to the platform default
-- (MAX_DELIVERY_MILES in lib/constants.ts). Enforced at checkout in
-- app/api/checkout/route.ts: delivery orders beyond this distance from the
-- shop are rejected.
--
-- Safe to run once; idempotent.

alter table dd_shops add column if not exists delivery_radius_miles numeric(4,1);

-- Fisherman's Donut (#1087): deliver within 5 miles.
update dd_shops set delivery_radius_miles = 5 where shop_number = 1087;
