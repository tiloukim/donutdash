-- Per-shop terminal credentials for the Dejavoo SPIn / iPOSpays cloud
-- integration. Separate from dd_shops so:
--   - We can grant tighter access to the sensitive auth_key column
--   - Future multi-terminal-per-shop support fits without table reshape
--   - The dd_shops row stays the public "menu / hours / address" surface
--
-- Today the POS app caches a copy in expo-secure-store on each device
-- (faster cold-start, offline-safe). The backend row is the source of
-- truth — admin web edits propagate to every Elo tablet at the shop
-- on next /api/pos/terminal-credentials GET, and re-installing the
-- app pulls fresh creds rather than asking the cashier to retype them.

create table if not exists dd_shop_terminal_credentials (
  -- One credential set per shop today. If a shop ever adds a second
  -- terminal (e.g. a P17 for the counter + a P8 for table-side), we
  -- swap shop_id → id (uuid) and add a separate shop_id FK column.
  shop_id uuid primary key references dd_shops(id) on delete cascade,

  -- SPIn auth pair from the iPOSpays portal:
  --   Menu → Settings → Generate Ecom/TOP Merchant Keys
  tpn text not null,
  auth_key text not null,

  -- Optional alphanumeric register identifier. Falls back to TPN in
  -- the cloud routing model when omitted.
  register_id text,

  -- Sandbox routes through test.spinpos.net; production through
  -- spinpos.net. Stored as text (not enum) so adding new endpoints
  -- later doesn't require an ALTER TYPE.
  environment text not null check (environment in ('sandbox', 'production')),

  -- Dejavoo model selected in the Settings → Card Terminal UI.
  -- Cosmetic on the POS side; useful in admin reports later.
  terminal_model text,

  -- Per-terminal capability flags. Handheld terminals (P8, Z11, etc.)
  -- can prompt for tip + print receipt themselves, so the POS skips
  -- those on-Elo flows when the flags are true.
  tip_on_terminal boolean not null default false,
  print_on_terminal boolean not null default false,

  updated_at timestamptz not null default now(),
  updated_by uuid references dd_users(id) on delete set null
);

-- RLS off intentionally — the /api/pos/terminal-credentials route
-- enforces "your shop only" auth via the service-role client. Adding
-- per-row RLS here would only matter if PostgREST were used directly
-- from the client, which we don't for sensitive auth keys.
alter table dd_shop_terminal_credentials disable row level security;

-- Touch updated_at on writes.
create or replace function dd_shop_terminal_creds_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_dd_shop_terminal_creds_updated_at on dd_shop_terminal_credentials;
create trigger trg_dd_shop_terminal_creds_updated_at
  before update on dd_shop_terminal_credentials
  for each row execute function dd_shop_terminal_creds_touch_updated_at();
