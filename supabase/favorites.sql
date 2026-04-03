CREATE TABLE IF NOT EXISTS dd_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dd_users(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES dd_shops(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, shop_id)
);
ALTER TABLE dd_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own favorites" ON dd_favorites FOR ALL USING (user_id = auth.uid());
