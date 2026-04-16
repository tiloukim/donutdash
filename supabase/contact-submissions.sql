-- Contact form submissions from support pages
CREATE TABLE IF NOT EXISTS dd_contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('customer', 'driver', 'shop_owner')),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_status ON dd_contact_submissions(status);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_category ON dd_contact_submissions(category);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_created ON dd_contact_submissions(created_at DESC);

ALTER TABLE dd_contact_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public insert contact_submissions" ON dd_contact_submissions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role full access contact_submissions" ON dd_contact_submissions
  FOR ALL USING (auth.role() = 'service_role');
