-- ============================================================
-- Customer referral program on/off switch.
--
-- Adds a `referral_program_enabled` flag to dd_platform_settings, edited from
-- /admin/settings. lib/referral.ts treats anything other than 'true' as OFF,
-- so the program is disabled until explicitly turned on.
--
-- Disabling stops new $5 credits from accruing and hides the referral section
-- on customer profiles. It does NOT touch existing dd_users.referral_credit
-- balances.
--
-- Run in the Supabase SQL editor.
-- ============================================================

insert into dd_platform_settings (key, value)
values ('referral_program_enabled', 'false')
on conflict (key) do nothing;
