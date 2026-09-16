-- Refund details, so a refund receipt can be printed and REPRINTED.
--
-- dd_orders recorded refund_amount and nothing else. That's enough to make
-- reports correct, but not enough to hand the customer a slip: a refund
-- receipt has to show WHEN the refund happened, HOW the money went back, and
-- the gateway reference for it — none of which we kept. Printing from the
-- sale row alone produced the ORIGINAL sale receipt, which is what the
-- cashier saw when they tried.
--
-- The refund's own Ref # matters most. It is a separate transaction at the
-- processor with its own reference, and it is what reconciles this refund
-- against the iPOSpays log. The original sale's Ref # identifies the charge,
-- not the credit.
--
-- Run in the Supabase SQL editor.

alter table public.dd_orders
  add column if not exists refunded_at        timestamptz,
  add column if not exists refund_ref_number  text,
  add column if not exists refund_auth_code   text,
  add column if not exists refund_method      text;

comment on column public.dd_orders.refunded_at is
  'When the most recent refund on this sale was issued. Null on sales never refunded, and on refunds recorded before this column existed.';
comment on column public.dd_orders.refund_ref_number is
  'Gateway reference (PNRef) for the REFUND leg — a separate transaction from the sale, with its own reference. Null on a void, which reverses the original authorization and creates no new transaction, and on cash.';
comment on column public.dd_orders.refund_auth_code is
  'Approval code for the refund leg, when the gateway returns one.';
comment on column public.dd_orders.refund_method is
  'How the money went back: void (authorization reversed before settlement, never reaches the statement), return (separate credit, 3-5 business days), or cash (from the drawer).';

-- Guard the vocabulary. These three are what the POS writes and what the
-- receipt switches on; anything else would print a slip that says nothing.
alter table public.dd_orders
  drop constraint if exists dd_orders_refund_method_check;
alter table public.dd_orders
  add constraint dd_orders_refund_method_check
  check (refund_method is null or refund_method in ('void', 'return', 'cash'));
