-- What each register actually is.
--
-- dd_pos_devices recorded a model string and nothing else, so "what hardware
-- is at that shop?" could only be answered by going to look. That is fine
-- with two registers and useless with twenty — and it is the question behind
-- every "will this build run there?" and "is that till out of disk?".
--
-- Read from the OS on the device, never inferred from the model name. That
-- distinction matters on this hardware: the C8 reports MANUFACTURER as
-- QUALCOMM, the chipset vendor, rather than whoever built the till — which is
-- also what made the Elo SDK mis-identify it as PayPoint hardware.

begin;

alter table public.dd_pos_devices
  add column if not exists android_release    text,
  add column if not exists android_sdk        integer,
  add column if not exists ram_total_mb       integer,
  add column if not exists ram_available_mb   integer,
  -- The DATA partition, which is the one that fills up and stops a register
  -- working, not the total flash on the spec sheet.
  add column if not exists storage_total_mb   integer,
  add column if not exists storage_free_mb    integer,
  add column if not exists screen_px          text,
  add column if not exists screen_density     real,
  -- Physical size. A 1920x1080 panel says nothing about whether it is a
  -- 10-inch till or a 15-inch one, and that is what decides whether a layout
  -- is readable from the far side of a counter.
  add column if not exists screen_inches      real,
  add column if not exists specs_updated_at   timestamptz;

commit;
