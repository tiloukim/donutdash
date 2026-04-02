-- Driver onboarding documents for tax & compliance
CREATE TABLE IF NOT EXISTS dd_driver_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES dd_users(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('w9', 'drivers_license', 'insurance', 'vehicle_registration', 'contractor_agreement')),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  expires_at DATE,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES dd_users(id)
);

-- One document per type per driver
CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_doc_type ON dd_driver_documents(driver_id, doc_type);

ALTER TABLE dd_driver_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers read own documents" ON dd_driver_documents
  FOR SELECT USING (driver_id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "Drivers insert own documents" ON dd_driver_documents
  FOR INSERT WITH CHECK (driver_id = auth.uid());

-- Storage bucket for driver documents (create in Supabase dashboard)
-- Bucket name: driver-documents
-- Private bucket (not public) — files accessed via signed URLs
