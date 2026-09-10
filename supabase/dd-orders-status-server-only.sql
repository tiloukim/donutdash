-- dd_orders.status may only be changed by the DonutDash server.
--
-- WHY
-- The POS signs in as the shop owner, and schema.sql's "Shop owners can update
-- orders for their shops" policy grants that session a blanket UPDATE on
-- dd_orders. So lib/api.advanceOrderStatus could -- and did -- write
-- status straight to Supabase, bypassing /api/shop/orders and with it driver
-- dispatch, the customer's status email, and the scheduled-order hold.
--
-- The app-side fix (donutdash-pos fa3dc2f) routes those writes through
-- /api/pos/orders/:id/status. But an app-side fix only protects registers
-- running current JS. Twice in one night a register on a stale OTA bundle kept
-- writing directly -- silently, because the row update succeeds. This makes the
-- database the place that says no, so a stale client fails loudly instead of
-- corrupting order state.
--
-- WHAT IT DOES NOT DO
-- Only `status` is guarded. Every legitimate status change already runs through
-- a service-role client (lib/order-transition.ts, the crons, the driver
-- routes), which is exempt. The one user-scoped dd_orders write in the codebase
-- (app/api/paypal/create sets payment_id) does not touch status and is
-- unaffected. Other columns remain writable under the existing policy -- see
-- the note at the bottom.

create or replace function dd_orders_guard_status_write() returns trigger
language plpgsql as $$
begin
  -- PostgREST runs as the JWT's role: 'authenticated' / 'anon' for app
  -- sessions, 'service_role' for the service key. 'postgres' covers the SQL
  -- editor and migrations.
  if new.status is distinct from old.status
     and current_user not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception
      'dd_orders.status is server-managed (attempted % -> % as %)',
      old.status, new.status, current_user
      using
        errcode = '42501',
        hint = 'Use /api/shop/orders (PATCH), /api/pos/orders/:id/status, or /api/pos/orders/:id/cancel. A client hitting this is almost certainly running a stale bundle.';
  end if;
  return new;
end $$;

-- `before update of status` only fires when status is in the UPDATE's column
-- list, so ordinary updates (payment_id, refund_amount, released_at) pay nothing.
drop trigger if exists trg_dd_orders_guard_status on dd_orders;
create trigger trg_dd_orders_guard_status
  before update of status on dd_orders
  for each row execute function dd_orders_guard_status_write();

-- VERIFY (run as the SQL editor's postgres role, so both should succeed):
--   -- exempt role: allowed
--   update dd_orders set status = status where id = '<some-id>';
--   -- simulate an app session: should raise 42501
--   set local role authenticated;
--   update dd_orders set status = 'confirmed' where id = '<some-id>';
--   reset role;
--
-- NOTE / follow-up
-- The same blanket policy also lets a shop-owner session write total, subtotal,
-- tip and commission_pct directly. Nothing in the apps does, but the exposure is
-- real. Narrowing that policy needs an audit of every client-side dd_orders
-- write first, so it is deliberately out of scope here.
