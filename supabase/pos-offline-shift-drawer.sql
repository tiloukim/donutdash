-- Offline-safe clock-in/out and drawer sessions.
--
-- The register can already queue SALES through an outage and replay them.
-- Shifts and drawer sessions could not: both were a live round trip, so a
-- shop with no internet could sell but could not clock anyone in or open a
-- drawer. Replaying them needs two things this migration provides.
--
-- 1. client_key — an idempotency key minted on the device. A replay of a
--    mutation the server already took must be a no-op, exactly as
--    (shop_id, client_order_id) does for dd_orders. Without it, a flush that
--    half-succeeded would open two drawers or start two shifts for one
--    physical event.
--
-- 2. Client-supplied timestamps (handled in the API, not here) — clock_in and
--    opened_at default to now(), which on replay is the moment the internet
--    came back rather than the moment the drawer actually opened. That is not
--    cosmetic: dd_drawer_sessions.expected_cash is computed from the sales
--    since opened_at, so a replayed opened_at would exclude every sale rung
--    during the outage and report the whole day's cash as an overage.
--
-- Partial indexes (where client_key is not null) so existing rows, and any
-- future mutation made online without a key, are unaffected.

alter table public.dd_drawer_sessions add column if not exists client_key text;
alter table public.dd_shifts         add column if not exists client_key text;

-- Scoped per shop rather than globally: the key is generated on a device and
-- only has to be unique within the shop it belongs to, which is the same
-- scope dd_orders uses for client_order_id.
create unique index if not exists dd_drawer_sessions_client_key_uniq
  on public.dd_drawer_sessions (shop_id, client_key)
  where client_key is not null;

create unique index if not exists dd_shifts_client_key_uniq
  on public.dd_shifts (shop_id, client_key)
  where client_key is not null;

-- Lets the replay path find an open drawer / open shift cheaply; both are
-- read on every open and close.
create index if not exists dd_drawer_sessions_open_idx
  on public.dd_drawer_sessions (shop_id)
  where closed_at is null;

create index if not exists dd_shifts_open_idx
  on public.dd_shifts (shop_id, user_id)
  where clock_out is null;

-- ── Invalidating a PIN a register has cached offline ──
--
-- Phase 1 lets a register verify a cashier's PIN locally during an outage,
-- against a digest it derived when the SERVER last accepted that PIN. That
-- leaves one hole: change a cashier's PIN in the portal and the register
-- knows nothing about it, so the OLD pin keeps working on that till until
-- the device next verifies online — up to the 30-day cache life. Fire
-- someone mid-outage and changing their PIN would not lock them out.
--
-- pin_updated_at is the fix: the roster endpoint returns it, and the device
-- drops any cached digest older than it. Using the existing updated_at
-- column instead would over-invalidate — editing an hourly rate would force
-- every cashier to re-verify online — which is safe but needlessly brittle
-- for a shop that is offline.
alter table public.dd_shop_staff add column if not exists pin_updated_at timestamptz;

-- Existing rows: seed from updated_at so a device cannot treat a digest
-- predating this migration as newer than the PIN it was made from. NULL
-- would read as "never changed", which is the wrong default here.
update public.dd_shop_staff
   set pin_updated_at = coalesce(updated_at, created_at)
 where pin_updated_at is null;
