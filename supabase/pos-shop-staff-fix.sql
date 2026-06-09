-- Drop the NOT NULL constraint on dd_users.auth_id.
--
-- Cashier rows from the multi-cashier POS flow are deliberately
-- AUTH-LESS: they're identified by name + PIN inside the owner's
-- already-authenticated device session. No Supabase auth account
-- per cashier means no email-verification onboarding friction and
-- no remote sign-in surface (cashier creds are kiosk-only, by design).
--
-- Existing rows all have auth_id set (real customer / driver /
-- shop_owner accounts came in through Supabase auth), so dropping
-- NOT NULL is a no-op for them. Only new POS cashier rows take
-- advantage of the relaxed constraint.

alter table dd_users alter column auth_id drop not null;
