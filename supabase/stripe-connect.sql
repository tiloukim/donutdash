-- Add Stripe Connect columns to dd_shops
ALTER TABLE dd_shops
  ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_complete BOOLEAN DEFAULT FALSE;

-- Index for quick lookup by stripe account
CREATE INDEX IF NOT EXISTS idx_dd_shops_stripe_account_id ON dd_shops (stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;
