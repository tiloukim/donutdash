-- Shop owner onboarding documents for tax & compliance
CREATE TABLE IF NOT EXISTS dd_shop_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES dd_shops(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES dd_users(id),
  doc_type TEXT NOT NULL CHECK (doc_type IN ('w9', 'business_license', 'health_permit', 'insurance_certificate', 'food_establishment_permit', 'sales_tax_permit', 'business_entity_docs')),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  expires_at DATE,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES dd_users(id)
);

-- One document per type per shop
CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_doc_type ON dd_shop_documents(shop_id, doc_type);

ALTER TABLE dd_shop_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop owners read own documents" ON dd_shop_documents
  FOR SELECT USING (uploaded_by = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "Shop owners insert own documents" ON dd_shop_documents
  FOR INSERT WITH CHECK (uploaded_by = auth.uid());

-- Storage bucket: shop-documents (create in Supabase dashboard)
