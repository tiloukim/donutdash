-- Weekly payout batches
CREATE TABLE IF NOT EXISTS dd_payout_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed')),
  total_driver_payouts NUMERIC(10,2) DEFAULT 0,
  total_shop_payouts NUMERIC(10,2) DEFAULT 0,
  total_amount NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES dd_users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payout_batch_week ON dd_payout_batches(week_start);

-- Individual payout items within a batch
CREATE TABLE IF NOT EXISTS dd_payout_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES dd_payout_batches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES dd_users(id),
  user_type TEXT NOT NULL CHECK (user_type IN ('driver', 'shop_owner')),
  shop_id UUID REFERENCES dd_shops(id),
  amount NUMERIC(10,2) NOT NULL,
  earnings_breakdown JSONB,
  bank_info JSONB, -- snapshot of bank details at time of payout
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'skipped')),
  notes TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payout_items_batch ON dd_payout_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_payout_items_user ON dd_payout_items(user_id);

ALTER TABLE dd_payout_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd_payout_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin access payout batches" ON dd_payout_batches
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admin access payout items" ON dd_payout_items
  FOR ALL USING (auth.role() = 'service_role');

-- Add bank_info columns to dd_users for saved bank details
ALTER TABLE dd_users ADD COLUMN IF NOT EXISTS bank_account_holder TEXT;
ALTER TABLE dd_users ADD COLUMN IF NOT EXISTS bank_routing_number TEXT;
ALTER TABLE dd_users ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
