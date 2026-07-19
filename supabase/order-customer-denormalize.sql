-- Denormalize the customer's name + phone onto dd_orders.
--
-- Why: the POS reads dd_orders with the cashier's session (anon key + RLS).
-- RLS on dd_users only exposes a user's own row, so the POS embed
-- `customer:dd_users(name)` came back null and the delivery order list showed
-- the literal fallback "Customer" for every order. Storing the name/phone on
-- the order lets the POS + receipts show who ordered without reading dd_users,
-- and keeps the order self-contained if the account is later deleted.
--
-- Safe to run more than once. Run in the Supabase SQL editor BEFORE deploying
-- the POS read-path change.

alter table dd_orders
  add column if not exists customer_name text,
  add column if not exists customer_phone text;

-- Backfill existing orders from the customer's dd_users row.
update dd_orders o
set customer_name  = u.name,
    customer_phone = u.phone
from dd_users u
where o.customer_id = u.id
  and (o.customer_name is null or o.customer_phone is null);
