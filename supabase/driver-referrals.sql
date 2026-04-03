-- Add delivery tracking columns to dd_referrals for driver-to-driver referrals
ALTER TABLE dd_referrals ADD COLUMN IF NOT EXISTS deliveries_required INTEGER DEFAULT 10;
ALTER TABLE dd_referrals ADD COLUMN IF NOT EXISTS deliveries_completed INTEGER DEFAULT 0;
