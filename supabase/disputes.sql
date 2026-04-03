CREATE TABLE IF NOT EXISTS dd_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES dd_orders(id),
  customer_id UUID NOT NULL REFERENCES dd_users(id),
  reason TEXT NOT NULL CHECK (reason IN ('wrong_items', 'missing_items', 'cold_food', 'late_delivery', 'never_delivered', 'damaged', 'other')),
  description TEXT,
  photo_url TEXT,
  refund_amount NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'refunded')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES dd_users(id)
);

ALTER TABLE dd_disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own disputes" ON dd_disputes FOR SELECT USING (customer_id = auth.uid() OR auth.role() = 'service_role');
CREATE POLICY "Users insert own disputes" ON dd_disputes FOR INSERT WITH CHECK (customer_id = auth.uid());
