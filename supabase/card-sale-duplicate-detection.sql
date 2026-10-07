-- Catching the same card charged twice for the same sale.
--
-- Follows supabase/card-sale-reconciliation.sql, which is already applied —
-- hence a separate file rather than an edit to it.
--
-- The failure is the same lost terminal response that loses a sale, only
-- the other way round: the terminal approves, the POS never hears, the
-- screen still offers Charge, and the cashier charges again. It has
-- happened three times, each ending in a refund.
--
-- Detection can't prevent it — prevention belongs in the register, which
-- must stop offering Charge until it knows whether the first one went
-- through. What this gives is the alarm: the owner hears within minutes
-- instead of finding it at close, and the customer is refunded the same
-- day rather than noticing on their statement.

alter table public.dd_processor_transactions
  add column if not exists duplicate_of uuid references public.dd_processor_transactions(id) on delete set null,
  add column if not exists duplicate_alerted_at timestamptz;

comment on column public.dd_processor_transactions.duplicate_of is
  'The earlier transaction this one appears to repeat: same terminal, same amount, same last four, minutes apart. A suspicion worth a human look, not a verdict — a customer really can buy the same thing twice.';
comment on column public.dd_processor_transactions.duplicate_alerted_at is
  'When someone was told. One alert per transaction, so the cron can run every few minutes without repeating itself.';

-- The duplicate sweep looks for recent transactions on a terminal with the
-- same amount and last four, so that is what it is indexed on.
create index if not exists dd_processor_transactions_dup_scan_idx
  on public.dd_processor_transactions (tpn, amount_cents, card_last4, occurred_at desc)
  where amount_cents is not null;
