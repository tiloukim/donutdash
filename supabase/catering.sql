-- Catering / Large Orders
CREATE TABLE IF NOT EXISTS dd_catering_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES dd_users(id),
  shop_id UUID NOT NULL REFERENCES dd_shops(id),
  event_date DATE NOT NULL,
  event_time TEXT,
  guest_count INTEGER,
  items_description TEXT NOT NULL,
  delivery_address TEXT,
  budget TEXT,
  phone TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'quoted', 'confirmed', 'completed', 'cancelled')),
  admin_notes TEXT,
  quote_amount NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE dd_catering_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access catering" ON dd_catering_requests FOR ALL USING (auth.role() = 'service_role');
