-- Allow the derived 'partially_paid' batch status (some items paid one-by-one
-- but not all). The old CHECK constraint only permitted pending/processing/
-- completed, which rejected the reconciled status. Recreate it as a superset
-- that includes every status the app uses.
ALTER TABLE dd_payout_batches DROP CONSTRAINT IF EXISTS dd_payout_batches_status_check;

ALTER TABLE dd_payout_batches
  ADD CONSTRAINT dd_payout_batches_status_check
  CHECK (status IN ('pending', 'processing', 'partially_paid', 'completed', 'failed', 'cancelled'));
