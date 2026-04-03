CREATE TABLE IF NOT EXISTS dd_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES dd_orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES dd_users(id),
  sender_role TEXT NOT NULL CHECK (sender_role IN ('customer', 'driver')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_order ON dd_chat_messages(order_id);
ALTER TABLE dd_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Chat participants can read" ON dd_chat_messages FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "Chat participants can insert" ON dd_chat_messages FOR INSERT WITH CHECK (auth.role() = 'service_role');
