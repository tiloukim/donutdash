-- DonutDash Cash functions, re-cut for per-shop wallets.
-- Run AFTER donutdash-cash-per-shop.sql.

begin;

-- ─────────────────────────────────────────────────────────────────────────
-- The wallet accessor now needs to know WHICH shop
-- ─────────────────────────────────────────────────────────────────────────
-- The single-argument version is dropped deliberately. Leaving it in place
-- would be the more cautious-looking move and the more dangerous one: any
-- caller still on it would silently keep reading a customer's wallet without
-- saying which shop's, and with a (customer, shop) unique index that now
-- means "an arbitrary one of their wallets". A missing function is a loud
-- error at deploy time; a wrong balance is a quiet one at the till.
drop function if exists public.dd_cash_wallet_for(uuid);

create or replace function public.dd_cash_wallet_for(p_customer uuid, p_shop uuid)
returns public.dd_cash_wallets
language plpgsql security definer set search_path = public as $$
declare w public.dd_cash_wallets;
begin
  if p_customer is null or p_shop is null then return null; end if;
  insert into public.dd_cash_wallets (customer_id, shop_id)
  values (p_customer, p_shop)
  on conflict (customer_id, shop_id) do nothing;
  select * into w from public.dd_cash_wallets
   where customer_id = p_customer and shop_id = p_shop;
  return w;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- EARN
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.dd_cash_earn(p_order_id uuid)
returns public.dd_cash_ledger
language plpgsql security definer set search_path = public as $$
declare
  o public.dd_orders;
  s public.dd_shops;
  w public.dd_cash_wallets;
  v_key text := 'earn:' || p_order_id::text;
  v_existing public.dd_cash_ledger;
  v_eligible bigint;
  v_bps integer;
  v_gross bigint;
  v_applied bigint;
  v_offset_used bigint;
  v_row public.dd_cash_ledger;
begin
  select * into v_existing from public.dd_cash_ledger where idempotency_key = v_key;
  if found then return v_existing; end if;          -- already earned; no-op

  select * into o from public.dd_orders where id = p_order_id;
  if not found or o.customer_id is null then return null; end if;

  -- Only a finished sale earns; a cancelled one must not. These are the
  -- statuses the platform ACTUALLY writes — 'completed' / 'paid' /
  -- 'fulfilled' appear nowhere, and gating on them would quietly award
  -- nothing while looking perfectly correct.
  if coalesce(o.status, '') not in ('delivered', 'picked_up') then
    return null;
  end if;

  select * into s from public.dd_shops where id = o.shop_id;
  if not found or not coalesce(s.rewards_enabled, false) then return null; end if;

  v_eligible := public.dd_cash_eligible_cents(o);
  if v_eligible < coalesce(s.reward_min_purchase_cents, 0) then return null; end if;

  w := public.dd_cash_wallet_for(o.customer_id, o.shop_id);
  perform pg_advisory_xact_lock(hashtextextended(w.id::text, 0));
  -- Re-read UNDER the lock. Two registers ringing the same customer at once
  -- would otherwise both compute from the same stale balance.
  select * into w from public.dd_cash_wallets where id = w.id;

  -- New at THIS shop, not new to DonutDash.
  --
  -- This used to ask whether the customer had ever earned anywhere. Once
  -- balances are per shop that is the wrong question: a regular at one shop
  -- walking into another for the first time IS a new customer there, and that
  -- shop's new-customer rate is the whole point of the setting. Scoped to the
  -- shop, each shop makes its own first impression.
  if exists (select 1 from public.dd_cash_ledger
             where customer_id = o.customer_id
               and shop_id = o.shop_id
               and transaction_type = 'EARN') then
    v_bps := s.reward_standard_bps;
  else
    v_bps := s.reward_new_customer_bps;
  end if;

  -- Round half up, once, on integers.
  v_gross := ((v_eligible * v_bps) + 5000) / 10000;
  if v_gross <= 0 then return null; end if;

  -- A refund shortfall is recovered here, before anything reaches the
  -- balance. The customer is never told they owe anything; they simply earn
  -- less until it is square.
  v_offset_used := least(v_gross, w.recoverable_offset_cents);
  v_applied := v_gross - v_offset_used;

  insert into public.dd_cash_ledger (
    customer_id, wallet_id, transaction_type, amount_cents, balance_after_cents,
    order_id, shop_id, funding_shop_id, redeeming_shop_id,
    rate_bps, eligible_cents, idempotency_key, description, metadata
  ) values (
    o.customer_id, w.id, 'EARN', v_applied, w.balance_cents + v_applied,
    o.id, o.shop_id, o.shop_id, null,
    v_bps, v_eligible, v_key,
    'Earned on order ' || coalesce(o.short_code, o.id::text),
    jsonb_build_object('gross_cents', v_gross, 'offset_recovered_cents', v_offset_used)
  ) returning * into v_row;

  update public.dd_cash_wallets
     set balance_cents            = balance_cents + v_applied,
         lifetime_earned_cents    = lifetime_earned_cents + v_applied,
         recoverable_offset_cents = recoverable_offset_cents - v_offset_used,
         updated_at               = now()
   where id = w.id;

  return v_row;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- REDEEM
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.dd_cash_redeem(
  p_order_id   uuid,
  p_customer   uuid,
  p_shop_id    uuid,
  p_requested_cents bigint
) returns public.dd_cash_ledger
language plpgsql security definer set search_path = public as $$
declare
  o public.dd_orders;
  s public.dd_shops;
  w public.dd_cash_wallets;
  v_key text := 'redeem:' || p_order_id::text;
  v_existing public.dd_cash_ledger;
  v_eligible bigint;
  v_amount bigint;
  v_row public.dd_cash_ledger;
begin
  select * into v_existing from public.dd_cash_ledger where idempotency_key = v_key;
  if found then return v_existing; end if;

  select * into s from public.dd_shops where id = p_shop_id;
  if not found or not coalesce(s.rewards_enabled, false) then return null; end if;

  -- This shop's wallet, and only this shop's. The old cross-store check is
  -- gone along with the pooled balance it was trying to police: there is no
  -- longer any such thing as spending another shop's money here, so there is
  -- nothing left to permit or refuse.
  w := public.dd_cash_wallet_for(p_customer, p_shop_id);
  if w.id is null then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended(w.id::text, 0));
  select * into w from public.dd_cash_wallets where id = w.id;

  select * into o from public.dd_orders where id = p_order_id;
  -- Pre-payment the order may not exist yet, in which case the caller passes
  -- the eligible figure and we trust the clamp below.
  v_eligible := case when found then public.dd_cash_eligible_cents(o) else p_requested_cents end;

  v_amount := least(
    greatest(p_requested_cents, 0),
    w.balance_cents,
    v_eligible,
    coalesce(s.reward_max_redeem_cents, p_requested_cents)
  );
  if v_amount <= 0 then return null; end if;

  insert into public.dd_cash_ledger (
    customer_id, wallet_id, transaction_type, amount_cents, balance_after_cents,
    order_id, shop_id, funding_shop_id, redeeming_shop_id,
    idempotency_key, description
  ) values (
    p_customer, w.id, 'REDEEM', -v_amount, w.balance_cents - v_amount,
    p_order_id, p_shop_id, p_shop_id, p_shop_id,
    v_key, 'DonutDash Cash applied'
  ) returning * into v_row;

  update public.dd_cash_wallets
     set balance_cents          = balance_cents - v_amount,
         lifetime_redeemed_cents = lifetime_redeemed_cents + v_amount,
         updated_at             = now()
   where id = w.id;

  return v_row;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- REFUND REVERSAL
-- ─────────────────────────────────────────────────────────────────────────
-- Unchanged in policy; it just has to find the right wallet now. The shop
-- comes off the EARN row being reversed, which is the only correct source:
-- the reward was funded by that shop and the clawback belongs to the same
-- wallet it was paid into.
create or replace function public.dd_cash_reverse_refund(p_order_id uuid)
returns public.dd_cash_ledger
language plpgsql security definer set search_path = public as $$
declare
  o public.dd_orders;
  v_earn public.dd_cash_ledger;
  w public.dd_cash_wallets;
  v_refunded_cents bigint;
  v_key text;
  v_existing public.dd_cash_ledger;
  v_share numeric;
  v_target bigint;
  v_already bigint;
  v_claw bigint;
  v_from_balance bigint;
  v_to_offset bigint;
  v_row public.dd_cash_ledger;
begin
  select * into o from public.dd_orders where id = p_order_id;
  if not found then return null; end if;

  v_refunded_cents := round(coalesce(o.refund_amount, 0) * 100)::bigint;
  if v_refunded_cents <= 0 then return null; end if;

  v_key := 'reversal:' || p_order_id::text || ':' || v_refunded_cents::text;
  select * into v_existing from public.dd_cash_ledger where idempotency_key = v_key;
  if found then return v_existing; end if;

  select * into v_earn from public.dd_cash_ledger
   where order_id = p_order_id and transaction_type = 'EARN';
  if not found or v_earn.eligible_cents is null or v_earn.eligible_cents <= 0 then
    return null;
  end if;

  -- The wallet the reward actually landed in, by id. Re-deriving it from
  -- (customer, shop) would give the same row today and would silently create
  -- an empty one if the EARN were ever reassigned; the id cannot drift.
  select * into w from public.dd_cash_wallets where id = v_earn.wallet_id;
  if not found then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended(w.id::text, 0));
  select * into w from public.dd_cash_wallets where id = w.id;

  v_share := least(1.0, v_refunded_cents::numeric / v_earn.eligible_cents::numeric);
  v_target := round(coalesce((v_earn.metadata->>'gross_cents')::bigint, v_earn.amount_cents) * v_share);

  select coalesce(-sum(amount_cents), 0) into v_already
    from public.dd_cash_ledger
   where order_id = p_order_id and transaction_type = 'REFUND_REVERSAL';

  v_claw := v_target - v_already;
  if v_claw <= 0 then return null; end if;

  -- Take what is there; the rest becomes a debt against future earnings
  -- rather than a negative balance.
  v_from_balance := least(v_claw, w.balance_cents);
  v_to_offset    := v_claw - v_from_balance;

  insert into public.dd_cash_ledger (
    customer_id, wallet_id, transaction_type, amount_cents, balance_after_cents,
    order_id, shop_id, funding_shop_id, idempotency_key, description, metadata
  ) values (
    v_earn.customer_id, w.id, 'REFUND_REVERSAL', -v_from_balance,
    w.balance_cents - v_from_balance,
    p_order_id, v_earn.shop_id, v_earn.funding_shop_id, v_key,
    'Reward reversed after refund',
    jsonb_build_object('clawback_cents', v_claw, 'to_offset_cents', v_to_offset)
  ) returning * into v_row;

  update public.dd_cash_wallets
     set balance_cents            = balance_cents - v_from_balance,
         recoverable_offset_cents = recoverable_offset_cents + v_to_offset,
         updated_at               = now()
   where id = w.id;

  return v_row;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Drift: per wallet, which now means per customer PER SHOP
-- ─────────────────────────────────────────────────────────────────────────
-- DROPPED first, not CREATE OR REPLACE.
--
-- Replace can only APPEND columns to a view; it cannot insert one in the
-- middle or rename an existing one. Adding shop_id as the second column made
-- Postgres read it as renaming the old second column and it refused:
--   cannot change name of view column "wallet_cents" to "shop_id"
-- No cascade: this view is a diagnostic with nothing depending on it, and if
-- something ever does, failing loudly beats dropping it silently.
drop view if exists public.dd_cash_wallet_drift;

create view public.dd_cash_wallet_drift as
  select w.customer_id,
         w.shop_id,
         w.balance_cents                       as wallet_cents,
         coalesce(sum(l.amount_cents), 0)      as ledger_cents,
         w.balance_cents - coalesce(sum(l.amount_cents), 0) as drift_cents
    from public.dd_cash_wallets w
    left join public.dd_cash_ledger l on l.wallet_id = w.id
   group by w.customer_id, w.shop_id, w.balance_cents
  having w.balance_cents <> coalesce(sum(l.amount_cents), 0);

commit;
