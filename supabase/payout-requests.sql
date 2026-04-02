-- Payout requests from drivers and shops
CREATE TABLE IF NOT EXISTS dd_payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dd_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('driver', 'shop_owner')),
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('zelle', 'venmo', 'cashapp', 'bank_transfer')),
  payment_info TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  notes TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ
);

ALTER TABLE dd_payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own requests" ON dd_payout_requests
  FOR SELECT USING (user_id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "Users insert own requests" ON dd_payout_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());
