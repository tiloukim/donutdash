-- Record WHY tax was not charged on a sale.
--
-- A cashier can now remove tax at the register — a student, a veteran, a
-- church, a school. dd_orders would show tax = 0.00 and nothing else, which
-- is indistinguishable from a shop that charges no tax at all, and is not
-- an answer at filing time.
--
-- The question a tax authority asks is not "was tax charged" but "why
-- wasn't it", and that has to survive on the row rather than in someone's
-- memory of a busy Saturday.
--
-- Run in the Supabase SQL editor.

alter table public.dd_orders
  add column if not exists tax_exempt        boolean not null default false,
  add column if not exists tax_exempt_reason text;

comment on column public.dd_orders.tax_exempt is
  'True when tax was deliberately removed at the register. Distinguishes an exempt sale from one that simply had no tax — tax = 0 alone cannot.';
comment on column public.dd_orders.tax_exempt_reason is
  'Why: Student, Vet, Church, School. Free text is accepted so the list can grow without a migration, but the register only offers those four.';

-- Exempt sales are the ones pulled for review, and they are a small
-- fraction of the table.
create index if not exists dd_orders_tax_exempt_idx
  on public.dd_orders (shop_id, created_at desc)
  where tax_exempt;
