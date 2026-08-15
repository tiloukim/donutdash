-- Guest checkout: an order placed by an anonymous (guest) session stores the
-- guest's email here so the receipt can reach them and staff can contact them.
-- Logged-in customers keep getting their receipt at their account email; this
-- is null for them unless captured. customer_id is already nullable, but guest
-- orders still set it to the guest's dd_users row (created for the anon auth
-- user), so RLS and order tracking work unchanged.
ALTER TABLE dd_orders ADD COLUMN IF NOT EXISTS customer_email text;
