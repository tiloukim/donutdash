-- Add 'vehicle_photo' to allowed doc_type values.
-- The API/UI already accept vehicle_photo, but the DB CHECK constraint predated
-- it, so the file uploaded to storage and then the row insert failed with
-- "dd_driver_documents_doc_type_check". This adds it to the constraint.
ALTER TABLE dd_driver_documents DROP CONSTRAINT IF EXISTS dd_driver_documents_doc_type_check;
ALTER TABLE dd_driver_documents ADD CONSTRAINT dd_driver_documents_doc_type_check
  CHECK (doc_type IN ('w9', 'drivers_license', 'drivers_license_back', 'insurance', 'vehicle_registration', 'vehicle_photo', 'contractor_agreement', 'selfie'));
