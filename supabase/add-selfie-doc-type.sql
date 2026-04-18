-- Add 'selfie' and 'drivers_license_back' to allowed doc_type values
ALTER TABLE dd_driver_documents DROP CONSTRAINT IF EXISTS dd_driver_documents_doc_type_check;
ALTER TABLE dd_driver_documents ADD CONSTRAINT dd_driver_documents_doc_type_check
  CHECK (doc_type IN ('w9', 'drivers_license', 'drivers_license_back', 'insurance', 'vehicle_registration', 'contractor_agreement', 'selfie'));
