-- SECURITY FIX: dd_sponsorship_orders had NO row-level security, so with
-- Supabase's default grants anyone holding the public anon key could read every
-- shop's Square payment_id + amounts and tamper with the paid-sponsorship
-- ledger. The app only touches this table via the service-role client (which
-- bypasses RLS), so enabling RLS with a service-role-only policy locks out
-- anon/authenticated clients without breaking anything.
ALTER TABLE dd_sponsorship_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages sponsorship orders" ON dd_sponsorship_orders;
CREATE POLICY "Service role manages sponsorship orders" ON dd_sponsorship_orders
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
