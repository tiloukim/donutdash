-- Idempotency key for POS sales.
--
-- The register has always minted a client_order_id for every queued order
-- (donutdash-pos lib/offline-queue.ts) and never sent it. The queue's own
-- header has carried the consequence as a TODO since it was written:
--
--   "if a request succeeds server-side but the client never sees the
--    response (timeout, dropped packet), the replay will create a SECOND
--    order."
--
-- That is not hypothetical. The POS posts with a 15s abort, and a sale that
-- lands at 15.1s is recorded once by the server and once by the replay —
-- one card charge, two rows, and a day that reads high by the amount of the
-- duplicated sale. Nothing downstream can tell the two rows apart, because
-- two identical baskets rung a minute apart are a normal morning.
--
-- The key makes the second write a no-op instead: /api/pos/orders catches
-- the unique violation and returns the row that already exists, so a replay
-- is indistinguishable from the original request succeeding.
--
-- PARTIAL index, deliberately. Every online/delivery order and every POS
-- sale rung before this shipped has a NULL here, and NULLs are not
-- comparable in a unique index anyway — but writing the WHERE clause says
-- so explicitly rather than relying on that.
--
-- Scoped to the shop, not global: the id is generated on-device from a
-- timestamp and Math.random(), so it is unique enough within one shop's
-- registers and does not need to be unique across the platform.

alter table dd_orders
  add column if not exists client_order_id text;

create unique index if not exists dd_orders_shop_client_order_id_uniq
  on dd_orders (shop_id, client_order_id)
  where client_order_id is not null;

comment on column dd_orders.client_order_id is
  'Idempotency key from the POS offline queue. Unique per shop. NULL for online orders and for POS sales predating the key.';
