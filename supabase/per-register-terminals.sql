-- Per-register (per-device) card-terminal credentials.
--
-- Extends dd_shop_terminal_credentials (see pos-terminal-credentials.sql) so a
-- shop can run one card terminal PER POS LANE. Previously the row was keyed by
-- shop_id alone, so every Elo/P18 at a shop shared one TPN and collided on
-- simultaneous card sales. We repoint the primary key to (shop_id, device_id)
-- so each device owns its own credentials row. The POS mints a stable per-
-- install device_id (expo-secure-store) and sends it on every call.
--
-- Pairs with the endpoint change that keys GET/PUT/DELETE on (shop_id,
-- device_id). Deploy THIS FIRST — the PUT upsert uses onConflict
-- (shop_id, device_id), which needs the composite PK below.
--
-- Backward-compatible: existing single-terminal rows are backfilled to the
-- 'legacy-default' device_id, so old clients that don't send a device_id keep
-- resolving to that row.

begin;

-- 1) New columns
alter table public.dd_shop_terminal_credentials
  add column if not exists device_id      text,
  add column if not exists register_label text;

-- 2) Backfill existing rows so current shops keep working — each already-
--    configured shop becomes its own "legacy default" register.
update public.dd_shop_terminal_credentials
  set device_id = 'legacy-default'
  where device_id is null;

alter table public.dd_shop_terminal_credentials
  alter column device_id set not null;

-- 3) Repoint the primary key from (shop_id) to (shop_id, device_id).
--    The inline `shop_id ... primary key` from the original table gets the
--    default constraint name dd_shop_terminal_credentials_pkey.
alter table public.dd_shop_terminal_credentials
  drop constraint if exists dd_shop_terminal_credentials_pkey;

alter table public.dd_shop_terminal_credentials
  add constraint dd_shop_terminal_credentials_pkey
  primary key (shop_id, device_id);

commit;

-- RLS note: device_id is NOT a security boundary — it only partitions rows
-- within a shop. Existing policies scope by shop_id (the caller's shop), which
-- lets a device read/manage any lane in its OWN shop (needed for the admin-web
-- overview) but no lane in another shop. Do NOT add a device_id filter to RLS.

-- Rollback (if needed):
--   begin;
--   alter table public.dd_shop_terminal_credentials
--     drop constraint if exists dd_shop_terminal_credentials_pkey;
--   alter table public.dd_shop_terminal_credentials
--     add constraint dd_shop_terminal_credentials_pkey primary key (shop_id);
--   alter table public.dd_shop_terminal_credentials
--     drop column if exists device_id,
--     drop column if exists register_label;
--   commit;
