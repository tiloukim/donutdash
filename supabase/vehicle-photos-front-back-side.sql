-- Split the single vehicle photo into front / back / side.
-- Adds vehicle_front, vehicle_back, vehicle_side to the doc_type constraint.
-- vehicle_photo is left in the list harmlessly (no rows ever used it) so this
-- is safe to run even if a stray row exists.
ALTER TABLE dd_driver_documents DROP CONSTRAINT IF EXISTS dd_driver_documents_doc_type_check;
ALTER TABLE dd_driver_documents ADD CONSTRAINT dd_driver_documents_doc_type_check
  CHECK (doc_type IN ('w9', 'drivers_license', 'drivers_license_back', 'insurance', 'vehicle_registration', 'vehicle_photo', 'vehicle_front', 'vehicle_back', 'vehicle_side', 'contractor_agreement', 'selfie'));
