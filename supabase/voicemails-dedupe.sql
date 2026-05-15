-- Dedupe voicemails when both Telnyx callbacks (action + recordingStatusCallback)
-- fire for the same call. Both pass CallSid; upsert on it.

alter table dd_voicemails add column if not exists call_sid text;

create unique index if not exists uq_dd_voicemails_call_sid
  on dd_voicemails(call_sid)
  where call_sid is not null;
