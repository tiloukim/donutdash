-- Owner PIN — gates entry to the POS Settings tab + sensitive sub-screens
-- (Card Terminal, Banking) so customers reaching across the counter
-- can't tamper with the configured terminal credentials or shop config.
-- Backed up by an auto-lock on the device side: 60s of no touches and
-- the cashier has to re-enter.
--
-- The cashier already authenticates against Supabase to sign in — the
-- PIN is a SECOND factor for sensitive in-app surfaces within an
-- already-authenticated session. PIN-only protection without auth
-- would be weak; auth-only protection without PIN leaves the entire
-- session vulnerable while the device sits unattended.

alter table dd_shops
  add column if not exists owner_pin_hash text,
  add column if not exists owner_pin_salt text,
  -- Brute-force defense: a 4-digit PIN has 10k combinations. Without
  -- rate limiting, a determined customer could just hammer the keypad.
  -- Five wrong tries = 10 minute cooldown; cashier has to wait or have
  -- the shop owner reset.
  add column if not exists owner_pin_failed_attempts integer not null default 0,
  add column if not exists owner_pin_locked_until timestamptz;

-- No indexes needed — these columns are only read alongside the shop
-- row in a single primary-key lookup.
