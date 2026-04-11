-- Add paused columns to dd_shops
ALTER TABLE dd_shops ADD COLUMN IF NOT EXISTS paused boolean DEFAULT false;
ALTER TABLE dd_shops ADD COLUMN IF NOT EXISTS pause_reason text DEFAULT null;
ALTER TABLE dd_shops ADD COLUMN IF NOT EXISTS pause_until timestamptz DEFAULT null;
