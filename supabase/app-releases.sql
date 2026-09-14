-- POS app releases — what the registers are allowed to install.
--
-- Separates BUILT from RELEASED. EAS produces a build from main on request;
-- main accumulates merges that have never run on a register. A row here is a
-- deliberate statement that a specific build is fit for the shop floor.
--
-- That gap is the whole point. A silent fleet-wide install is a bigger lever
-- than an OTA, and an OTA already put this register on a white screen once.
-- Nothing reaches a till until someone flips is_released on a row.
--
-- Run in the Supabase SQL editor.

create table if not exists public.dd_app_releases (
  id            uuid primary key default gen_random_uuid(),
  -- Android versionCode. The device compares against its own PackageManager
  -- value and refuses anything not strictly greater, so this must be the real
  -- versionCode of the APK at `apk_url`, not the marketing version.
  build_number  integer not null unique,
  -- Human version, e.g. '1.0.1'. Display only.
  version       text not null,
  -- Direct APK link (an EAS artifact URL).
  apk_url       text not null,
  -- Shown to whoever is standing at the register before they install.
  notes         text,
  -- Gate. false = built and recorded, not yet offered to any device.
  is_released   boolean not null default false,
  released_at   timestamptz,
  created_at    timestamptz not null default now()
);

comment on table public.dd_app_releases is
  'POS APK builds and whether each is cleared for install. /api/pos/latest-build serves the highest build_number with is_released = true. Recording a build does NOT release it.';

comment on column public.dd_app_releases.build_number is
  'Android versionCode of the APK. Devices refuse anything not strictly greater than their own, so a stale or un-released row cannot downgrade a working register.';

comment on column public.dd_app_releases.is_released is
  'Release gate. Set true only after the build has run on a real register. This is the last human step before an install can reach the fleet.';

-- Serving the manifest reads the newest released row; both filters are hot.
create index if not exists dd_app_releases_released_idx
  on public.dd_app_releases (is_released, build_number desc);

alter table public.dd_app_releases enable row level security;

-- No policies, deliberately. Every read goes through /api/pos/latest-build on
-- the service role, which authenticates the caller first. Leaving this table
-- unreadable to anon/authenticated means an APK URL can't be enumerated by
-- anyone who happens to hold a Supabase anon key.
