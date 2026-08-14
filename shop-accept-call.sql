-- Records when the auto "accept this order" phone call was placed to a shop,
-- so the escalation cron calls at most once per order.
--
-- Run in the Supabase SQL editor. Safe to re-run.

ALTER TABLE dd_orders ADD COLUMN IF NOT EXISTS accept_call_at timestamptz;
