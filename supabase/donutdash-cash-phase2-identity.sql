-- DonutDash Cash, phase 2 — one customer, one phone, one balance.
--
-- Walk-in customers are dd_users rows with role='customer'. Phone is free
-- text and search is ILIKE, so the same person can already exist several
-- times over: three numbers in live data had duplicates, and one of them
-- (626-xxx-9094) came out of the points conversion holding TWO wallets. That
-- customer could not spend their own balance.
--
-- This file does three things:
--   1. normalises phone into a stored column, so matching is on digits
--      rather than on how somebody typed it;
--   2. merges the existing duplicates behind a pointer, WITHOUT touching a
--      single order;
--   3. adds the unique index that stops it happening again.
--
-- Order history is deliberately left alone. dd_orders.customer_id keeps
-- whatever it was written with — that is what reports and refunds read, and
-- rewriting settled orders to tidy up customer records is not a trade worth
-- making. Everything that needs the real person resolves through merged_into.
--
-- Re-runnable. Run in the Supabase SQL editor.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Normalised phone
-- ─────────────────────────────────────────────────────────────────────────
-- Stored generated column: the database owns the rule, so a client that
-- forgets to normalise cannot create a duplicate anyway.
--
-- NANP only, which is all this platform serves. 10 digits, or 11 with a
-- leading 1. Anything else normalises to null and simply does not
-- participate in matching, rather than matching wrongly.
alter table public.dd_users
  add column if not exists phone_normalized text
  generated always as (
    case
      when phone is null then null
      when length(regexp_replace(phone, '\D', '', 'g')) = 11
           and left(regexp_replace(phone, '\D', '', 'g'), 1) = '1'
        then right(regexp_replace(phone, '\D', '', 'g'), 10)
      when length(regexp_replace(phone, '\D', '', 'g')) = 10
        then regexp_replace(phone, '\D', '', 'g')
      else null
    end
  ) stored;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Merge pointer
-- ─────────────────────────────────────────────────────────────────────────
alter table public.dd_users
  add column if not exists merged_into uuid references public.dd_users(id) on delete set null,
  add column if not exists merged_at   timestamptz;

create index if not exists dd_users_merged_into_idx
  on public.dd_users (merged_into) where merged_into is not null;

-- Follow the pointer to the surviving record. Bounded rather than recursive:
-- a merge target is itself never merged (the survivor is always chosen from
-- unmerged rows), so one hop is enough — but the loop guards against a chain
-- created by hand later, and against a cycle.
create or replace function public.dd_customer_canonical(p_user uuid)
returns uuid language plpgsql stable set search_path = public as $$
declare v_id uuid := p_user; v_next uuid; i int := 0;
begin
  loop
    select merged_into into v_next from public.dd_users where id = v_id;
    exit when v_next is null or i >= 5;
    v_id := v_next; i := i + 1;
  end loop;
  return v_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Merge the duplicates that already exist
-- ─────────────────────────────────────────────────────────────────────────
-- Survivor per phone: the record with the most orders, earliest created_at
-- breaking the tie. That keeps the identity with the most history attached
-- and avoids promoting an empty guest record over a real one.
--
-- Balances move as a matched pair of ledger rows — out of the duplicate, into
-- the survivor — so each wallet still reconciles against its own ledger and
-- dd_cash_wallet_drift stays empty. Nothing is silently reassigned.
do $$
declare
  grp  record;
  dup  record;
  v_survivor uuid;
  w_dup public.dd_cash_wallets;
  w_sur public.dd_cash_wallets;
  v_amt bigint;
begin
  for grp in
    select phone_normalized
      from public.dd_users
     where role = 'customer' and merged_into is null and phone_normalized is not null
     group by phone_normalized
    having count(*) > 1
  loop
    select u.id into v_survivor
      from public.dd_users u
      left join (
        select customer_id, count(*) n from public.dd_orders group by customer_id
      ) o on o.customer_id = u.id
     where u.role = 'customer' and u.merged_into is null
       and u.phone_normalized = grp.phone_normalized
     order by coalesce(o.n, 0) desc, u.created_at asc
     limit 1;

    for dup in
      select id from public.dd_users
       where role = 'customer' and merged_into is null
         and phone_normalized = grp.phone_normalized
         and id <> v_survivor
    loop
      -- Move any balance before the pointer is set, so the wallet is empty
      -- by the time it stops being reachable.
      select * into w_dup from public.dd_cash_wallets where customer_id = dup.id;
      if found and w_dup.balance_cents > 0
         and not exists (select 1 from public.dd_cash_ledger
                          where idempotency_key = 'merge:out:' || dup.id::text) then
        v_amt := w_dup.balance_cents;
        w_sur := public.dd_cash_wallet_for(v_survivor);

        insert into public.dd_cash_ledger (
          customer_id, wallet_id, transaction_type, amount_cents,
          balance_after_cents, idempotency_key, description, metadata
        ) values (
          dup.id, w_dup.id, 'ADMIN_ADJUSTMENT', -v_amt, 0,
          'merge:out:' || dup.id::text,
          'Balance moved to merged customer record',
          jsonb_build_object('merged_into', v_survivor)
        );

        insert into public.dd_cash_ledger (
          customer_id, wallet_id, transaction_type, amount_cents,
          balance_after_cents, idempotency_key, description, metadata
        ) values (
          v_survivor, w_sur.id, 'ADMIN_ADJUSTMENT', v_amt,
          w_sur.balance_cents + v_amt,
          'merge:in:' || dup.id::text,
          'Balance received from merged duplicate record',
          jsonb_build_object('merged_from', dup.id)
        );

        update public.dd_cash_wallets
           set balance_cents = 0, updated_at = now() where id = w_dup.id;
        update public.dd_cash_wallets
           set balance_cents = balance_cents + v_amt,
               lifetime_earned_cents = lifetime_earned_cents + v_amt,
               updated_at = now()
         where id = w_sur.id;
      end if;

      update public.dd_users
         set merged_into = v_survivor, merged_at = now()
       where id = dup.id;
    end loop;
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Stop it happening again
-- ─────────────────────────────────────────────────────────────────────────
-- Only live customer records compete for a number. Merged rows are excluded,
-- so the historical duplicates stay exactly as they were.
create unique index if not exists dd_users_customer_phone_uniq
  on public.dd_users (phone_normalized)
  where role = 'customer' and merged_into is null and phone_normalized is not null;

-- Lookup index for the checkout search path.
create index if not exists dd_users_phone_normalized_idx
  on public.dd_users (phone_normalized) where phone_normalized is not null;
