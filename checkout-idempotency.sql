-- Idempotency for checkout: a stable per-attempt key from the browser lets a
-- retry after a lost response (network drop AFTER the card was charged) return
-- the SAME order instead of creating a second order + second charge.
-- The key is cleared when an order is cancelled (declined) so a customer can
-- retry a fixed card with a fresh attempt.
ALTER TABLE dd_orders ADD COLUMN IF NOT EXISTS checkout_key text;

-- Partial unique index: only enforce uniqueness on live (non-null) keys, so the
-- many historical/cancelled orders with NULL keys don't collide.
CREATE UNIQUE INDEX IF NOT EXISTS idx_dd_orders_checkout_key
  ON dd_orders(checkout_key) WHERE checkout_key IS NOT NULL;
