-- Persist the convenience-fee rate charged on each sale.
--
-- Companion to order-tax-rate.sql, for the same reason. The processor asked
-- for the fee to print as "Convenience Fee 3.5%" rather than a bare label
-- (Brian Bridgman, 2026-09-15), which means the receipt needs the RATE and
-- dd_orders only stored the dollar amount.
--
-- Storing it per order rather than reading the shop's current rate at print
-- time is what keeps a reprint honest: a sale rung at 3.5% must keep
-- reprinting 3.5% after the shop moves to a different rate, because that is
-- what the customer actually paid.
--
-- Run in the Supabase SQL editor.

alter table public.dd_orders
  add column if not exists card_surcharge_pct numeric(6,3);

comment on column public.dd_orders.card_surcharge_pct is
  'Convenience-fee rate charged to the customer on this order, as a PERCENT (3.5 = 3.5%). Distinct from dd_shops.pos_card_fee_pct, which is what the PROCESSOR charges the shop. Null on orders rung before this column existed — receipts fall back to an unlabelled fee line.';
