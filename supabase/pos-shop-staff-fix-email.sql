-- Drop NOT NULL on dd_users.email for the same reason as auth_id:
-- POS cashier rows from the multi-cashier flow don't have an email.
-- They're identified by name + PIN inside the owner's already-
-- authenticated device session, not via Supabase auth.
--
-- Walk-in customers also legitimately lack emails (cashier rings up
-- a stranger who declines to give one); the constraint never caught
-- that case before because the createWalkinCustomer flow asked for
-- email and the cashier usually provided it.

alter table dd_users alter column email drop not null;
