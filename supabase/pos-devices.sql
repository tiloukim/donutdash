-- POS device presence tracking.
--
-- Each POS install (Elo / tablet) heartbeats the backend every ~45s while
-- open, so admins can see which registers are online and which card
-- terminal each one is configured for. Keyed on (shop_id, device_id) to
-- match dd_shop_terminal_credentials — one row per physical device.
--
-- Written only via /api/pos/heartbeat using the service client, so RLS is
-- enabled with NO policies: that locks the table to the service role and
-- blocks any direct anon/authenticated access.

create table if not exists dd_pos_devices (
  shop_id                  uuid        not null references dd_shops(id) on delete cascade,
  device_id                text        not null,
  register_label           text,
  platform                 text,
  app_version              text,
  card_terminal_tpn        text,
  -- Live terminal reachability (Phase 3): the app probes SPIn every few
  -- minutes and reports whether the terminal answered. null = not checked
  -- / no terminal configured. checked_at ages the reading in the admin UI.
  card_terminal_connected  boolean,
  card_terminal_checked_at timestamptz,
  -- Public IP the last heartbeat came from (captured server-side from the
  -- request headers) — shows which network/shop a register is reporting from.
  last_ip                  text,
  last_seen_at             timestamptz not null default now(),
  created_at               timestamptz not null default now(),
  primary key (shop_id, device_id)
);

-- Idempotent adds for tables created before these columns existed.
alter table dd_pos_devices add column if not exists card_terminal_connected  boolean;
alter table dd_pos_devices add column if not exists card_terminal_checked_at timestamptz;
alter table dd_pos_devices add column if not exists last_ip                  text;

-- List a shop's devices most-recently-seen first.
create index if not exists dd_pos_devices_shop_last_seen_idx
  on dd_pos_devices (shop_id, last_seen_at desc);

alter table dd_pos_devices enable row level security;
