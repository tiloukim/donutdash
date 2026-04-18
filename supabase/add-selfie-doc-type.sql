-- Add 'selfie' to allowed doc_type values for driver identity verification
ALTER TABLE dd_driver_documents DROP CONSTRAINT IF EXISTS dd_driver_documents_doc_type_check;
ALTER TABLE dd_driver_documents ADD CONSTRAINT dd_driver_documents_doc_type_check
  CHECK (doc_type IN ('w9', 'drivers_license', 'insurance', 'vehicle_registration', 'contractor_agreement', 'selfie'));
