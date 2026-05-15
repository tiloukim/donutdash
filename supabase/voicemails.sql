-- Archive of voicemails left on the IVR. Recording itself is hosted by
-- Telnyx; we store the URL plus metadata + listened/notes state.

create table if not exists dd_voicemails (
  id uuid primary key default uuid_generate_v4(),
  caller_number text not null,
  recording_url text not null,
  duration_seconds integer not null default 0,
  received_at timestamptz not null default now(),
  listened_at timestamptz,
  notes text
);

create index if not exists idx_dd_voicemails_received on dd_voicemails(received_at desc);
create index if not exists idx_dd_voicemails_unlistened on dd_voicemails(listened_at) where listened_at is null;
