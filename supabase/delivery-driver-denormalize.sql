-- Denormalize the assigned driver's name + phone onto dd_deliveries.
--
-- Same RLS problem as the customer name: the POS reads with the cashier's
-- session, and RLS on dd_users hides other users' rows, so the embed
-- `driver:dd_users(name)` came back null and the delivery list/detail never
-- showed the driver. Store the driver's name/phone on the delivery row when a
-- driver is assigned; clear it when the delivery is unassigned.
--
-- Safe to run more than once. Run in the Supabase SQL editor BEFORE deploying
-- the POS read-path change.

alter table dd_deliveries
  add column if not exists driver_name text,
  add column if not exists driver_phone text;

-- Backfill currently-assigned deliveries from the driver's dd_users row.
update dd_deliveries d
set driver_name  = u.name,
    driver_phone = u.phone
from dd_users u
where d.driver_id = u.id
  and (d.driver_name is null or d.driver_phone is null);
