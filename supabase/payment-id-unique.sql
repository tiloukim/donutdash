-- Webhook idempotency. Stripe retries checkout.session.completed on any
-- non-2xx response, and the webhook handler had no dedupe — every retry
-- inserted a fresh dd_orders row, double-awarding loyalty + double-notifying
-- admins. The partial unique index lets POS walk-ins (payment_id NULL)
-- coexist while forcing real Stripe/Square payment_ids to map to exactly
-- one order row.
--
-- If this fails on existing duplicate rows, run:
--   select payment_id, count(*) from dd_orders
--     where payment_id is not null group by 1 having count(*) > 1;
-- and reconcile before re-running.

create unique index if not exists idx_dd_orders_payment_id_unique
  on dd_orders (payment_id)
  where payment_id is not null;
