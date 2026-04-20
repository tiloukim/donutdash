-- Store W-9 tax data for drivers (needed for 1099-NEC filing)
-- SSN/EIN stored encrypted at rest by Supabase

ALTER TABLE dd_users ADD COLUMN IF NOT EXISTS w9_legal_name TEXT;
ALTER TABLE dd_users ADD COLUMN IF NOT EXISTS w9_business_name TEXT;
ALTER TABLE dd_users ADD COLUMN IF NOT EXISTS w9_tax_classification TEXT;
ALTER TABLE dd_users ADD COLUMN IF NOT EXISTS w9_address TEXT;
ALTER TABLE dd_users ADD COLUMN IF NOT EXISTS w9_city TEXT;
ALTER TABLE dd_users ADD COLUMN IF NOT EXISTS w9_state TEXT;
ALTER TABLE dd_users ADD COLUMN IF NOT EXISTS w9_zip TEXT;
ALTER TABLE dd_users ADD COLUMN IF NOT EXISTS w9_tax_id_type TEXT; -- 'ssn' or 'ein'
ALTER TABLE dd_users ADD COLUMN IF NOT EXISTS w9_tax_id TEXT; -- full SSN or EIN (encrypted at rest)
ALTER TABLE dd_users ADD COLUMN IF NOT EXISTS w9_submitted_at TIMESTAMPTZ;
