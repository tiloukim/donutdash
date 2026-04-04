-- Push notification subscriptions
CREATE TABLE IF NOT EXISTS dd_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dd_users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON dd_push_subscriptions(user_id);
ALTER TABLE dd_push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access push_subs" ON dd_push_subscriptions FOR ALL USING (true);
