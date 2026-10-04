-- Why a register is or isn't running an OTA bundle.
--
-- dd_pos_devices.ota_update_id was the only signal, and it is null for THREE
-- different reasons that need completely different responses:
--
--   1. the build has updates disabled        -> rebuild it
--   2. a roll-back-to-embedded directive is active -> publish past it
--   3. it downloaded one but hasn't cold-started   -> restart the register
--
-- Collapsing those into one null is why "OTA never applies" went unexplained
-- for weeks: the branch actually had two roll-back-to-embedded directives on
-- it, which is case 2, and it read identically to case 1.
--
-- These columns come straight off expo-updates on the device.
alter table dd_pos_devices add column if not exists updates_enabled boolean;
alter table dd_pos_devices add column if not exists updates_embedded_launch boolean;
alter table dd_pos_devices add column if not exists updates_channel text;
alter table dd_pos_devices add column if not exists updates_runtime_version text;

-- Outcome of the last check the app ran at launch: 'downloaded' (will apply on
-- the next cold start), 'up-to-date', 'error', or 'disabled'. Without this a
-- download that is silently failing looks exactly like one that found nothing.
alter table dd_pos_devices add column if not exists updates_last_check text;
alter table dd_pos_devices add column if not exists updates_last_check_at timestamptz;
