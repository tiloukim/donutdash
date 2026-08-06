-- Tracks which expiry a shop was already reminded about, so the daily
-- expiry-reminder cron sends exactly one "your feature is about to end" notice
-- per feature window (and a fresh one after the shop renews, since renewing
-- changes sponsor_expires_at).
--
-- Run in the Supabase SQL editor. Safe to re-run.

ALTER TABLE dd_shops ADD COLUMN IF NOT EXISTS sponsor_reminded_for timestamptz;
