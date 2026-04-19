-- Add driver_status column to dd_users
ALTER TABLE dd_users ADD COLUMN IF NOT EXISTS driver_status TEXT
  CHECK (driver_status IN ('pending_documents', 'pending_approval', 'approved'));

-- Set existing drivers to pending_documents (they'll need to complete onboarding)
UPDATE dd_users SET driver_status = 'pending_documents' WHERE role = 'driver' AND driver_status IS NULL;
