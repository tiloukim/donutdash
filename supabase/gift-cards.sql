-- Gift Cards
CREATE TABLE IF NOT EXISTS dd_gift_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  amount NUMERIC(10,2) NOT NULL,
  balance NUMERIC(10,2) NOT NULL,
  purchased_by UUID REFERENCES dd_users(id),
  recipient_email TEXT,
  recipient_name TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'expired')),
  created_at TIMESTAMPTZ DEFAULT now(),
  redeemed_by UUID REFERENCES dd_users(id),
  redeemed_at TIMESTAMPTZ
);

ALTER TABLE dd_gift_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access gift cards" ON dd_gift_cards FOR ALL USING (auth.role() = 'service_role');

-- Add credit_balance to dd_users if not exists
ALTER TABLE dd_users ADD COLUMN IF NOT EXISTS credit_balance NUMERIC(10,2) NOT NULL DEFAULT 0;
