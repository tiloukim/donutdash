-- Codes we issue ourselves when Twilio Verify is unreachable.
--
-- Twilio Verify generates, stores, expires and checks the code for us. The
-- moment it is unavailable — as it was when the account went to status 4 and
-- took signup, role auth and the rewards balance check down with it — none of
-- that exists any more, so a fallback has to provide it. This table is that,
-- and nothing else: it is empty whenever Twilio is healthy.
--
-- The code is stored HASHED. It is a short-lived credential that grants access
-- to someone's account, and a table of plaintext codes is a table of live
-- passwords. sha256 over code + phone, so an attacker with the table cannot
-- precompute one rainbow table for all six-digit codes.

begin;

create table if not exists public.dd_phone_verifications (
  id                uuid primary key default gen_random_uuid(),
  -- 10 US digits, the same shape normalizePhone() produces, so a lookup can
  -- never miss because one caller passed +1 and another did not.
  phone_normalized  text        not null,
  code_hash         text        not null,
  expires_at        timestamptz not null,
  -- Counted so a six-digit code cannot be walked through. Checked and
  -- incremented in the same statement, so two parallel guesses cannot both
  -- read the same count.
  attempts          integer     not null default 0,
  -- Set the moment a code is accepted. A code is good exactly once; without
  -- this, anyone who sees it in a notification preview could reuse it until
  -- it expired.
  consumed_at       timestamptz,
  created_at        timestamptz not null default now()
);

-- Lookups are always "the live code for this number", newest first.
create index if not exists dd_phone_verifications_lookup_idx
  on public.dd_phone_verifications (phone_normalized, created_at desc);

-- Housekeeping: nothing reads a row past its expiry, and keeping spent
-- credentials around serves no purpose.
create index if not exists dd_phone_verifications_expiry_idx
  on public.dd_phone_verifications (expires_at);

-- Server-only. No client ever reads this table: a policy-less RLS table is
-- reachable by the service role and by nobody else, which is exactly right
-- for a credential store.
alter table public.dd_phone_verifications enable row level security;

commit;
