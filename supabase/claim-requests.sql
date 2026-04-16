-- Shop Claim Requests Migration
-- Admin-reviewed document-based claim flow (replaces auto-approval).

CREATE TABLE IF NOT EXISTS dd_shop_claim_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES dd_shops(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES dd_users(id) ON DELETE CASCADE,
  requester_name text,
  requester_email text,
  requester_phone text,
  relationship text, -- 'owner', 'manager', 'employee'
  business_license_url text,
  utility_bill_url text,
  health_permit_url text,
  additional_docs_url text,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied')),
  admin_notes text,
  reviewed_by uuid REFERENCES dd_users(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (shop_id, requester_id, status) -- prevent duplicate pending requests
);

CREATE INDEX IF NOT EXISTS idx_claim_requests_shop ON dd_shop_claim_requests(shop_id);
CREATE INDEX IF NOT EXISTS idx_claim_requests_status ON dd_shop_claim_requests(status);

ALTER TABLE dd_shop_claim_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own claim requests" ON dd_shop_claim_requests
  FOR SELECT USING (requester_id IN (SELECT id FROM dd_users WHERE auth_id = auth.uid()));

CREATE POLICY "Users create own claim requests" ON dd_shop_claim_requests
  FOR INSERT WITH CHECK (requester_id IN (SELECT id FROM dd_users WHERE auth_id = auth.uid()));
