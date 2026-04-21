-- Archive table for deleted driver tax records (IRS requires 4-year retention)
CREATE TABLE IF NOT EXISTS dd_tax_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Original driver info
  original_user_id UUID,
  -- W-9 fields
  legal_name TEXT,
  business_name TEXT,
  tax_classification TEXT,
  w9_address TEXT,
  w9_city TEXT,
  w9_state TEXT,
  w9_zip TEXT,
  tax_id_type TEXT,
  tax_id TEXT,  -- encrypted SSN/EIN
  w9_submitted_at TIMESTAMPTZ,
  -- Earnings summary
  total_earnings NUMERIC(10,2) DEFAULT 0,
  total_deliveries INT DEFAULT 0,
  earnings_year INT,
  -- Metadata
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  retain_until TIMESTAMPTZ,  -- 4 years from deletion
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cleanup of expired records
CREATE INDEX idx_tax_archive_retain ON dd_tax_archive(retain_until);
