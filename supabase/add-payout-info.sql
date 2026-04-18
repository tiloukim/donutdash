-- Add payout method preference + PayPal/Venmo/CashApp fields to dd_users
-- (bank_account_holder, bank_routing_number, bank_account_number already exist)
ALTER TABLE dd_users ADD COLUMN IF NOT EXISTS payout_method TEXT CHECK (payout_method IN ('ach', 'paypal', 'venmo', 'cashapp'));
ALTER TABLE dd_users ADD COLUMN IF NOT EXISTS paypal_email TEXT;
ALTER TABLE dd_users ADD COLUMN IF NOT EXISTS venmo_handle TEXT;
ALTER TABLE dd_users ADD COLUMN IF NOT EXISTS cashapp_handle TEXT;
