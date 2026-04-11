-- Add paused column to dd_shops
ALTER TABLE dd_shops ADD COLUMN IF NOT EXISTS paused boolean DEFAULT false;
-- Optional: add pause reason
ALTER TABLE dd_shops ADD COLUMN IF NOT EXISTS pause_reason text DEFAULT null;
