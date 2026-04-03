CREATE TABLE IF NOT EXISTS dd_loyalty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dd_users(id) ON DELETE CASCADE UNIQUE,
  points INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dd_loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dd_users(id),
  order_id UUID REFERENCES dd_orders(id),
  points INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earned', 'redeemed', 'bonus', 'expired')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE dd_loyalty ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd_loyalty_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own loyalty" ON dd_loyalty FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Users read own transactions" ON dd_loyalty_transactions FOR ALL USING (auth.role() = 'service_role');
