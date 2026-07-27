-- Payment idempotency. Guards against a retried confirmation inserting a
-- fresh dd_orders row for a payment that already has one (which would
-- double-award loyalty + double-notify admins). The partial unique index
-- lets POS walk-ins (payment_id NULL) coexist while forcing real Square
-- payment_ids to map to exactly one order row.
--
-- If this fails on existing duplicate rows, run:
--   select payment_id, count(*) from dd_orders
--     where payment_id is not null group by 1 having count(*) > 1;
-- and reconcile before re-running.

create unique index if not exists idx_dd_orders_payment_id_unique
  on dd_orders (payment_id)
  where payment_id is not null;
