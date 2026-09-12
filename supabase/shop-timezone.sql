-- Per-shop timezone for rendering times to humans.
--
-- Vercel functions run in UTC, and every server-side toLocaleString() had no
-- timeZone, so a 12:30 UTC slot went out by SMS as "Sep 12, 12:30 PM" when the
-- shop and the customer both meant 7:30 AM Central. The shop reads that as a
-- lunchtime order and bakes five hours late.
--
-- Default matches every shop on the platform today (Tyler, TX). Set it per
-- shop as the platform expands rather than assuming Central forever.
alter table dd_shops add column if not exists timezone text not null default 'America/Chicago';
