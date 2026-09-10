-- Released-at marker for held scheduled orders.
--
-- release-scheduled-orders used to dedupe by flipping status pending ->
-- confirmed. That broke the shop alert: the tablet only chimes for orders it
-- sees with status='pending' (app/shop/layout.tsx), and the realtime hook only
-- listens for INSERTs -- a days-old row flipped to 'confirmed' by a cron fires
-- neither. It also meant any early confirm (admin/manual) permanently
-- disqualified the order from ever being released or announced.
--
-- The release now stamps released_at and LEAVES the order pending, so a
-- released scheduled order behaves exactly like a fresh one: it appears in the
-- shop feed as NEW, chimes, and the shop's Accept (pending -> confirmed)
-- dispatches a driver through the existing path.
alter table dd_orders add column if not exists released_at timestamptz;

-- The cron selects on (status, released_at, scheduled_for) every minute.
create index if not exists dd_orders_scheduled_release_idx
  on dd_orders (scheduled_for)
  where status = 'pending' and released_at is null and scheduled_for is not null;
