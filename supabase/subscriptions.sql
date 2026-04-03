CREATE TABLE IF NOT EXISTS dd_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dd_users(id) ON DELETE CASCADE UNIQUE,
  plan TEXT NOT NULL DEFAULT 'pass' CHECK (plan IN ('pass')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);
ALTER TABLE dd_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own sub" ON dd_subscriptions FOR ALL USING (auth.role() = 'service_role');
