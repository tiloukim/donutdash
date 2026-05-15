-- Single-row table of IVR runtime settings. Admin /admin/ivr writes here;
-- /api/telnyx/voice reads on every call (cached briefly in lib helper).

create table if not exists dd_ivr_settings (
  id integer primary key default 1,
  forward_number text not null default '+19033455599',
  business_hours_start integer not null default 7,
  business_hours_end integer not null default 17,
  dial_timeout_seconds integer not null default 20,
  updated_at timestamptz not null default now(),
  constraint dd_ivr_settings_singleton check (id = 1)
);

insert into dd_ivr_settings (id) values (1) on conflict (id) do nothing;
