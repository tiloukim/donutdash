-- SECURITY FIX: the "Authenticated users can view driver locations" policy let
-- ANY authenticated session (including anonymous guest checkouts) directly read
-- every driver's live GPS from dd_driver_locations (and stream it via realtime),
-- bypassing the scoped /api/driver/track route. Driver positions are only ever
-- served to clients through that API (which verifies the caller is the order's
-- customer, the assigned driver, the shop owner, or an admin) — no client reads
-- this table directly — so we remove the blanket read policy. Drivers still
-- access their own row via "Drivers can manage own location", and the service
-- role (the API) bypasses RLS.
DROP POLICY IF EXISTS "Authenticated users can view driver locations" ON dd_driver_locations;
