-- Duplicate-customer merge, re-cut for per-shop wallets.
--
-- The original (donutdash-cash-phase2-identity.sql, section 3) assumed one
-- wallet per customer and would now fail outright on its own first step:
--
--   select * into w_dup from public.dd_cash_wallets where customer_id = dup.id;
--
-- With wallets keyed on (customer, shop) that SELECT can match several rows,
-- which raises TOO_MANY_ROWS rather than quietly picking one — a good failure,
-- but a failure. The duplicate's balances have to move shop by shop, into the
-- survivor's wallet AT THE SAME SHOP, because a balance held by one shop can
-- never become a balance at another.
--
-- Balances still move as a matched pair of ledger rows — out of the duplicate,
-- into the survivor — so each wallet reconciles against its own ledger and
-- dd_cash_wallet_drift stays empty. Idempotent via the per-wallet keys, so
-- re-running is a no-op.

begin;

do $$
declare
  grp  record;
  dup  record;
  wal  record;
  v_survivor uuid;
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
      -- Every shop the duplicate holds money at, handled on its own terms.
      -- The idempotency key carries the wallet id, not just the customer id,
      -- so a customer with balances at two shops produces two independent
      -- transfers instead of the second being mistaken for a replay of the
      -- first.
      for wal in
        select * from public.dd_cash_wallets
         where customer_id = dup.id and balance_cents > 0
      loop
        if exists (select 1 from public.dd_cash_ledger
                    where idempotency_key = 'merge:out:' || wal.id::text) then
          continue;
        end if;

        v_amt := wal.balance_cents;
        w_sur := public.dd_cash_wallet_for(v_survivor, wal.shop_id);

        insert into public.dd_cash_ledger (
          customer_id, wallet_id, transaction_type, amount_cents,
          balance_after_cents, shop_id, idempotency_key, description, metadata
        ) values (
          dup.id, wal.id, 'ADMIN_ADJUSTMENT', -v_amt, 0, wal.shop_id,
          'merge:out:' || wal.id::text,
          'Balance moved to merged customer record',
          jsonb_build_object('merged_into', v_survivor)
        );

        insert into public.dd_cash_ledger (
          customer_id, wallet_id, transaction_type, amount_cents,
          balance_after_cents, shop_id, idempotency_key, description, metadata
        ) values (
          v_survivor, w_sur.id, 'ADMIN_ADJUSTMENT', v_amt,
          w_sur.balance_cents + v_amt, wal.shop_id,
          'merge:in:' || wal.id::text,
          'Balance received from merged duplicate record',
          jsonb_build_object('merged_from', dup.id)
        );

        update public.dd_cash_wallets
           set balance_cents = 0, updated_at = now() where id = wal.id;
        update public.dd_cash_wallets
           set balance_cents = balance_cents + v_amt,
               lifetime_earned_cents = lifetime_earned_cents + v_amt,
               updated_at = now()
         where id = w_sur.id;
      end loop;

      update public.dd_users
         set merged_into = v_survivor, merged_at = now()
       where id = dup.id;
    end loop;
  end loop;
end $$;

commit;
