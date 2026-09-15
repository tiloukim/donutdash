-- Persist the sales-tax rate that was in effect on each sale.
--
-- The live receipt prints "Tax (8.25%)" because the cart still holds the
-- rate in memory. A reprint from the Transactions tab rebuilds the receipt
-- from dd_orders, which stores the tax DOLLARS but not the RATE — so the
-- reprint drops to a bare "Tax" line and no longer matches the slip the
-- customer was handed.
--
-- Storing the rate rather than re-deriving tax/subtotal also keeps old
-- receipts honest after the shop's rate changes: a sale rung at 8.25%
-- must keep reprinting 8.25% even once the shop moves to a new rate.
--
-- Run in the Supabase SQL editor.

alter table public.dd_orders
  add column if not exists tax_rate numeric(6,5);

comment on column public.dd_orders.tax_rate is
  'Sales-tax rate applied to this order, as a fraction (0.0825 = 8.25%). Null on orders rung before this column existed — receipts fall back to an unlabelled "Tax" line, exactly as they do today.';
