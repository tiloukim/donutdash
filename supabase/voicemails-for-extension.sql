-- Track which extension a voicemail was left for, so /admin/voicemails
-- can show it and the SMS notification can target the right owner.

alter table dd_voicemails add column if not exists for_extension text;
alter table dd_voicemails add column if not exists for_extension_name text;

create index if not exists idx_dd_voicemails_for_extension on dd_voicemails(for_extension) where for_extension is not null;
