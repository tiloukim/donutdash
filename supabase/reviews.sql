-- Customer reviews for shops and drivers
CREATE TABLE IF NOT EXISTS dd_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES dd_orders(id) ON DELETE CASCADE UNIQUE,
  customer_id UUID NOT NULL REFERENCES dd_users(id),
  shop_id UUID NOT NULL REFERENCES dd_shops(id),
  driver_id UUID REFERENCES dd_users(id),
  shop_rating INTEGER NOT NULL CHECK (shop_rating >= 1 AND shop_rating <= 5),
  driver_rating INTEGER NOT NULL CHECK (driver_rating >= 1 AND driver_rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_shop ON dd_reviews(shop_id);
CREATE INDEX IF NOT EXISTS idx_reviews_driver ON dd_reviews(driver_id);
CREATE INDEX IF NOT EXISTS idx_reviews_order ON dd_reviews(order_id);

ALTER TABLE dd_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access reviews" ON dd_reviews
  FOR ALL USING (auth.role() = 'service_role');
