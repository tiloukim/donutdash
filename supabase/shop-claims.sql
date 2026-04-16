-- Shop Claims Migration
-- Run this in your Supabase SQL Editor to enable the "claim your shop" feature.

-- Make owner_id nullable so unclaimed shops can exist
ALTER TABLE dd_shops ALTER COLUMN owner_id DROP NOT NULL;

-- Add claim-related columns
ALTER TABLE dd_shops ADD COLUMN IF NOT EXISTS is_claimed boolean DEFAULT true;
ALTER TABLE dd_shops ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
ALTER TABLE dd_shops ADD COLUMN IF NOT EXISTS claim_source text; -- 'google_places', 'manual', etc.
ALTER TABLE dd_shops ADD COLUMN IF NOT EXISTS external_place_id text; -- Google Place ID to dedupe

-- Mark existing shops as claimed (they have owners)
UPDATE dd_shops SET is_claimed = true, claimed_at = created_at WHERE owner_id IS NOT NULL AND is_claimed IS NULL;

CREATE INDEX IF NOT EXISTS idx_dd_shops_claimed ON dd_shops(is_claimed);
CREATE INDEX IF NOT EXISTS idx_dd_shops_place_id ON dd_shops(external_place_id);
