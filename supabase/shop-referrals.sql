-- Shop referral program
CREATE TABLE IF NOT EXISTS dd_shop_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_shop_id UUID REFERENCES dd_shops(id),
  referrer_user_id UUID NOT NULL REFERENCES dd_users(id),
  referee_shop_id UUID REFERENCES dd_shops(id),
  referee_user_id UUID NOT NULL REFERENCES dd_users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  referrer_credit NUMERIC(10,2) DEFAULT 100.00,
  referee_credit NUMERIC(10,2) DEFAULT 100.00,
  orders_required INTEGER DEFAULT 20,
  orders_completed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE dd_shop_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role access shop referrals" ON dd_shop_referrals FOR ALL USING (auth.role() = 'service_role');

-- Add shop referral code to dd_shops
ALTER TABLE dd_shops ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
