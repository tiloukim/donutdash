-- Direct-dial extensions for the IVR. Caller dials a 2-4 digit extension
-- (e.g., 100) during the main menu prompt and is routed to that person's
-- phone number.

create table if not exists dd_ivr_extensions (
  id uuid primary key default uuid_generate_v4(),
  extension text not null unique,
  name text not null,
  phone_number text not null,
  voicemail_only boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dd_ivr_extensions_active on dd_ivr_extensions(active);
