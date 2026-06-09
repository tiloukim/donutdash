-- Per-shop staff roster. Backs the multi-cashier flow on the POS:
-- multiple people can clock in on the same Elo tablet, each
-- identified by name + 4-digit PIN (Square-style team-member switch).
--
-- Important design choice: cashiers do NOT have their own Supabase
-- auth accounts. The DEVICE has the shop_owner's Supabase session;
-- the cashier picker is a soft "who's working" overlay within that
-- session. dd_users.auth_id stays null for cashier-only users. This
-- means:
--   - No password management for cashiers (PINs handled in-app)
--   - No email-verification friction when onboarding
--   - Cashiers can't sign in remotely (donutdash.app) — by design
--   - Shift / sale attribution still works (dd_users.id is the link)
--
-- Roles ladder (used by the permission-tier guards in the POS):
--   cashier — ring sales, clock in/out, view their own shift
--   manager — everything cashier can + refunds, void, menu edit
--   owner   — manager + Card Terminal config, banking close, settings
--
-- The owner's own dd_users row gets a dd_shop_staff entry with
-- role='owner' on first launch of the multi-cashier flow, so the
-- attribution model is consistent (every clock-in is a staff row).

create table if not exists dd_shop_staff (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references dd_shops(id) on delete cascade,
  user_id uuid not null references dd_users(id) on delete cascade,

  role text not null default 'cashier'
    check (role in ('cashier', 'manager', 'owner')),

  -- 4–6 digit PIN. PBKDF2-SHA512 at 200k iterations matches what we
  -- use for the Owner PIN (lib/pin-hash.ts).
  pin_hash text not null,
  pin_salt text not null,

  -- Per-cashier counter so brute-force on the PIN keypad is bounded.
  -- 5 wrong tries → 10 min cooldown, same policy as the owner PIN.
  pin_failed_attempts integer not null default 0,
  pin_locked_until timestamptz,

  -- Optional for payroll. Owner sets, never shown to the cashier on
  -- their own profile pill. Stored at 2-decimal precision.
  hourly_rate numeric(6, 2),

  -- Soft-delete via status='inactive' (vs hard delete) so historic
  -- shift / sale attribution stays intact.
  status text not null default 'active'
    check (status in ('active', 'inactive')),

  created_at timestamptz not null default now(),
  created_by uuid references dd_users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- One row per (shop, user) — same user could be staff at multiple
-- shops (legitimately for multi-location operators) but never twice
-- at the same shop.
create unique index if not exists dd_shop_staff_shop_user_idx
  on dd_shop_staff(shop_id, user_id);

-- Picker query — "active staff at this shop, alphabetical."
create index if not exists dd_shop_staff_shop_status_idx
  on dd_shop_staff(shop_id, status);

-- RLS off — writes via /api/pos/cashiers (service-role + auth check),
-- reads via the same route. The picker DOES need a list of names +
-- ids without exposing pin_hash; that's enforced in the route's
-- select shape, not at the DB layer.
alter table dd_shop_staff disable row level security;

-- Touch updated_at on every write.
create or replace function dd_shop_staff_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_dd_shop_staff_updated_at on dd_shop_staff;
create trigger trg_dd_shop_staff_updated_at
  before update on dd_shop_staff
  for each row execute function dd_shop_staff_touch_updated_at();
