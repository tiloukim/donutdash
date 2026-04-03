ALTER TABLE dd_users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE dd_users ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES dd_users(id);
ALTER TABLE dd_users ADD COLUMN IF NOT EXISTS referral_credit NUMERIC(10,2) DEFAULT 0;

CREATE TABLE IF NOT EXISTS dd_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES dd_users(id),
  referee_id UUID NOT NULL REFERENCES dd_users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  referrer_credit NUMERIC(10,2) DEFAULT 1.00,
  referee_credit NUMERIC(10,2) DEFAULT 1.00,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE dd_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access referrals" ON dd_referrals FOR ALL USING (auth.role() = 'service_role');
