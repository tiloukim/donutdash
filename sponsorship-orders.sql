-- Self-serve sponsorship purchases. Each row is a shop paying (via Square) to
-- feature itself for a set number of days. The live state still lives on
-- dd_shops (is_sponsored / sponsor_rank / sponsor_expires_at); this table is
-- the paid-order ledger behind it (accounting + history).
--
-- Run in the Supabase SQL editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS dd_sponsorship_orders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid NOT NULL REFERENCES dd_shops(id) ON DELETE CASCADE,
  plan        text NOT NULL,                 -- plan id (week / month / premium)
  amount      numeric(10,2) NOT NULL,        -- dollars charged
  days        integer NOT NULL,              -- feature duration purchased
  payment_id  text,                          -- Square payment id
  starts_at   timestamptz NOT NULL DEFAULT now(),
  ends_at     timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sponsorship_orders_shop
  ON dd_sponsorship_orders (shop_id, created_at DESC);
