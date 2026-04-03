CREATE TABLE IF NOT EXISTS dd_group_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES dd_users(id),
  shop_id UUID NOT NULL REFERENCES dd_shops(id),
  share_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'locked', 'ordered')),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '2 hours')
);

CREATE TABLE IF NOT EXISTS dd_group_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_order_id UUID NOT NULL REFERENCES dd_group_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES dd_users(id),
  user_name TEXT,
  menu_item_id UUID NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  special_instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE dd_group_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd_group_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access group orders" ON dd_group_orders FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Users access group items" ON dd_group_order_items FOR ALL USING (auth.role() = 'service_role');
