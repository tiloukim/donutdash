-- Sponsored / featured shops (admin-curated marketplace placement).
--
-- A shop is a "live sponsor" when is_sponsored = true AND the campaign hasn't
-- expired (sponsor_expires_at is null or in the future). Live sponsors get a
-- front-page banner, top placement in listings, and a "Sponsored" badge.
--
-- Run in the Supabase SQL editor. Safe to re-run (IF NOT EXISTS).

ALTER TABLE dd_shops ADD COLUMN IF NOT EXISTS is_sponsored      boolean NOT NULL DEFAULT false;
ALTER TABLE dd_shops ADD COLUMN IF NOT EXISTS sponsor_rank      integer NOT NULL DEFAULT 0;   -- higher = shown first
ALTER TABLE dd_shops ADD COLUMN IF NOT EXISTS sponsor_headline  text;                          -- banner tagline
ALTER TABLE dd_shops ADD COLUMN IF NOT EXISTS sponsor_banner_url text;                         -- banner image (falls back to banner_url)
ALTER TABLE dd_shops ADD COLUMN IF NOT EXISTS sponsor_expires_at timestamptz;                  -- null = no expiry

-- Fast lookup of the live-sponsor set.
CREATE INDEX IF NOT EXISTS idx_dd_shops_sponsored
  ON dd_shops (sponsor_rank DESC)
  WHERE is_sponsored = true;
