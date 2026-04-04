-- Support chat between shop owners and admin
CREATE TABLE IF NOT EXISTS dd_support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES dd_shops(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES dd_users(id),
  sender_role TEXT NOT NULL CHECK (sender_role IN ('shop_owner', 'admin')),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_shop ON dd_support_messages(shop_id);
CREATE INDEX IF NOT EXISTS idx_support_created ON dd_support_messages(created_at);

ALTER TABLE dd_support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access support" ON dd_support_messages FOR ALL USING (true);
