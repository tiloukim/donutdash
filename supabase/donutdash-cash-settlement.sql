-- DonutDash Cash — cross-store settlement accounting.
--
-- When a customer spends at shop B money that shop A funded, A owes B. The
-- ledger has recorded both halves since the first row — funding_shop_id and
-- redeeming_shop_id — so this file does not need to reconstruct anything; it
-- reads what is already there.
--
-- NO money moves here. This is the accounting foundation: it works out who
-- owes whom for a period, records that as an obligation, and lets someone
-- mark it paid once the transfer has actually happened by whatever means.
-- Automating the transfer is a separate decision with separate risk, and the
-- books should be right before anything is wired to a bank.
--
-- Run in the Supabase SQL editor.

-- ─────────────────────────────────────────────────────────────────────────
-- What is owed, before anything has been settled
-- ─────────────────────────────────────────────────────────────────────────
-- Gross lines: one row per (funder, redeemer) pair per redemption window.
-- Only redemptions where the two differ — a shop honouring its own Cash owes
-- nobody anything.
create or replace view public.dd_cash_cross_store_redemptions as
  select funding_shop_id,
         redeeming_shop_id,
         created_at,
         -amount_cents as amount_cents,   -- REDEEM rows are negative; owed is positive
         order_id,
         customer_id,
         id as ledger_id
    from public.dd_cash_ledger
   where transaction_type = 'REDEEM'
     and funding_shop_id is not null
     and redeeming_shop_id is not null
     and funding_shop_id <> redeeming_shop_id;

-- ─────────────────────────────────────────────────────────────────────────
-- Recorded obligations
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.dd_cash_settlements (
  id                uuid primary key default gen_random_uuid(),
  period_start      timestamptz not null,
  period_end        timestamptz not null,
  funding_shop_id   uuid not null references public.dd_shops(id),
  redeeming_shop_id uuid not null references public.dd_shops(id),
  -- Gross for the pair in this direction. Netting against the opposite
  -- direction is done when PAYING, not when recording: both debts are real
  -- and each shop should be able to see its own side without the other's
  -- subtracted from it.
  amount_cents      bigint not null check (amount_cents > 0),
  status            text not null default 'pending'
                      check (status in ('pending', 'paid', 'void')),
  paid_at           timestamptz,
  -- However the money actually moved: a bank reference, a cheque number, an
  -- invoice id. Free text because the mechanism is not decided yet.
  payment_reference text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- One obligation per pair per period. Re-running a weekly prepare cannot
-- create a second bill for a week already billed.
create unique index if not exists dd_cash_settlements_period_pair_uniq
  on public.dd_cash_settlements (period_start, period_end, funding_shop_id, redeeming_shop_id);

create index if not exists dd_cash_settlements_funding_idx
  on public.dd_cash_settlements (funding_shop_id, status);
create index if not exists dd_cash_settlements_redeeming_idx
  on public.dd_cash_settlements (redeeming_shop_id, status);

alter table public.dd_cash_settlements enable row level security;
-- No client policies. Settlement is between the platform and its shops;
-- it is read and written by admin server code holding the service role.

-- ─────────────────────────────────────────────────────────────────────────
-- Prepare a period
-- ─────────────────────────────────────────────────────────────────────────
-- Idempotent: running it twice for the same window updates the pending
-- amounts rather than doubling them, and never touches a row already paid.
-- A paid row is history — if more redemptions land in a window that has
-- already been settled, they belong in a correction, not in a silent edit of
-- what somebody has already been invoiced for.
create or replace function public.dd_cash_settlement_prepare(
  p_from timestamptz,
  p_to   timestamptz
) returns setof public.dd_cash_settlements
language plpgsql security definer set search_path = public as $$
begin
  insert into public.dd_cash_settlements (
    period_start, period_end, funding_shop_id, redeeming_shop_id, amount_cents
  )
  select p_from, p_to, r.funding_shop_id, r.redeeming_shop_id, sum(r.amount_cents)
    from public.dd_cash_cross_store_redemptions r
   where r.created_at >= p_from and r.created_at <= p_to
   group by r.funding_shop_id, r.redeeming_shop_id
  having sum(r.amount_cents) > 0
  on conflict (period_start, period_end, funding_shop_id, redeeming_shop_id)
  do update set amount_cents = excluded.amount_cents,
                updated_at   = now()
   where public.dd_cash_settlements.status = 'pending';

  return query
    select * from public.dd_cash_settlements
     where period_start = p_from and period_end = p_to
     order by amount_cents desc;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Net position
-- ─────────────────────────────────────────────────────────────────────────
-- What actually changes hands once both directions are offset. Pairs are
-- ordered so A↔B appears once rather than twice with opposite signs: `owes`
-- is always the payer and `owed` always the payee.
create or replace view public.dd_cash_settlement_net as
  with pairs as (
    select least(funding_shop_id, redeeming_shop_id)    as a,
           greatest(funding_shop_id, redeeming_shop_id) as b,
           period_start, period_end,
           case when funding_shop_id < redeeming_shop_id then amount_cents else 0 end as a_owes_b,
           case when funding_shop_id > redeeming_shop_id then amount_cents else 0 end as b_owes_a
      from public.dd_cash_settlements
     where status = 'pending'
  )
  select period_start, period_end, a, b,
         sum(a_owes_b) as a_owes_b_cents,
         sum(b_owes_a) as b_owes_a_cents,
         case when sum(a_owes_b) >= sum(b_owes_a) then a else b end as owes,
         case when sum(a_owes_b) >= sum(b_owes_a) then b else a end as owed,
         abs(sum(a_owes_b) - sum(b_owes_a))              as net_cents
    from pairs
   group by period_start, period_end, a, b
  having abs(sum(a_owes_b) - sum(b_owes_a)) > 0;

-- ─────────────────────────────────────────────────────────────────────────
-- Platform-held liability
-- ─────────────────────────────────────────────────────────────────────────
-- Balances no shop funded: the converted points, and any future
-- platform-funded promotion. They are a real obligation to customers and
-- belong on somebody's books — they simply are not any single shop's.
--
-- Separate from the per-shop figure in dd_cash_report on purpose: an owner
-- reading their own liability should not be shown money the platform owes.
create or replace view public.dd_cash_platform_liability as
  select coalesce(sum(amount_cents), 0) as unfunded_cents
    from public.dd_cash_ledger
   where funding_shop_id is null;
