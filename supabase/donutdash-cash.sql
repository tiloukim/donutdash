-- DonutDash Cash — customer rewards, held as money rather than points.
--
-- Replaces the points programme in dd_loyalty / dd_loyalty_transactions. Those
-- tables are LEFT IN PLACE by this file: see the conversion block at the end,
-- which is a separate, deliberate step.
--
-- Three rules shape everything here.
--
--   1. Integer cents. No floats touch a balance. Rates are basis points
--      (500 bps = 5%), so a rate is an integer too and a shop setting can
--      never arrive as 0.05000000000000001.
--
--   2. The ledger is the truth; the wallet is a cache of it. Every movement
--      writes a ledger row, and the wallet is only ever updated in the same
--      statement that writes one. A balance with no row behind it is a bug,
--      and the reconciliation view at the bottom will find it.
--
--   3. Nothing mutates a balance except the functions below. RLS denies
--      insert/update/delete on both tables to every client role, including
--      shop owners. A cashier who can edit a reward balance is a cashier who
--      can pay themselves.
--
-- Run in the Supabase SQL editor.

-- ─────────────────────────────────────────────────────────────────────────
-- Shop settings
-- ─────────────────────────────────────────────────────────────────────────
-- Added to dd_shops rather than a side table: these are read on every
-- checkout, and the shop row is already loaded there.
alter table public.dd_shops
  add column if not exists rewards_enabled                boolean not null default false,
  -- Basis points. 500 = 5%. Integer on purpose; see rule 1.
  add column if not exists reward_new_customer_bps        integer not null default 500,
  add column if not exists reward_standard_bps            integer not null default 300,
  -- Accept DonutDash Cash funded by OTHER shops. Off until settlement runs.
  add column if not exists reward_cross_store_enabled     boolean not null default false,
  -- null = never expires. No expiry job ships in this phase.
  add column if not exists reward_expiration_days         integer,
  add column if not exists reward_min_purchase_cents      integer not null default 0,
  -- null = no per-order cap beyond the balance and the eligible amount.
  add column if not exists reward_max_redeem_cents        integer;

-- Guarded so the whole file stays re-runnable; a bare ADD CONSTRAINT fails
-- the second time and would abort everything after it.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'dd_shops_reward_bps_sane'
  ) then
    alter table public.dd_shops
      add constraint dd_shops_reward_bps_sane
      check (
        reward_new_customer_bps between 0 and 5000
        and reward_standard_bps between 0 and 5000
      ) not valid;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- Wallet — one per customer, across every shop
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.dd_cash_wallets (
  id                        uuid primary key default gen_random_uuid(),
  -- dd_users.id with role='customer'. There is no separate customer table;
  -- a walk-in and a future app account are the same row, which is what makes
  -- a balance earned at the counter spendable in the app later.
  customer_id               uuid not null unique references public.dd_users(id) on delete cascade,
  balance_cents             bigint  not null default 0 check (balance_cents >= 0),
  -- What the customer owes back after a refund took away merchandise their
  -- reward was earned on, when the reward had already been spent.
  --
  -- A separate column rather than a negative balance: a customer should never
  -- be shown that they are in debt to a donut shop, and a till should never
  -- have to explain it. Future earnings pay this down first, so the money is
  -- recovered without anyone having a conversation about it.
  recoverable_offset_cents  bigint  not null default 0 check (recoverable_offset_cents >= 0),
  lifetime_earned_cents     bigint  not null default 0 check (lifetime_earned_cents >= 0),
  lifetime_redeemed_cents   bigint  not null default 0 check (lifetime_redeemed_cents >= 0),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- Ledger — immutable, and the only explanation for any balance
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.dd_cash_ledger (
  id                 uuid primary key default gen_random_uuid(),
  customer_id        uuid not null references public.dd_users(id) on delete cascade,
  wallet_id          uuid not null references public.dd_cash_wallets(id) on delete cascade,
  transaction_type   text not null check (transaction_type in (
    'EARN', 'REDEEM', 'REFUND_REVERSAL', 'EXPIRATION',
    'ADMIN_ADJUSTMENT', 'TRANSFER_SETTLEMENT'
  )),
  -- SIGNED, from the customer's point of view: positive adds to their
  -- balance, negative takes from it. Summing this column per customer must
  -- equal their balance; the reconciliation view asserts exactly that.
  amount_cents       bigint not null,
  balance_after_cents bigint not null check (balance_after_cents >= 0),

  order_id           uuid references public.dd_orders(id) on delete set null,
  -- Where the movement physically happened.
  shop_id            uuid references public.dd_shops(id) on delete set null,
  -- Which shop's money this is. On an EARN the two are the same. On a REDEEM
  -- of cross-store Cash they differ, and that difference is the settlement:
  -- funding_shop owes redeeming_shop. Recorded from the first row written,
  -- because a reward whose funder is unknown can never be settled.
  funding_shop_id    uuid references public.dd_shops(id) on delete set null,
  redeeming_shop_id  uuid references public.dd_shops(id) on delete set null,

  -- Audit of HOW an EARN was computed, so a disputed reward can be explained
  -- years later without re-deriving it from settings that have since changed.
  rate_bps           integer,
  eligible_cents     bigint,

  -- The idempotency key. Every movement names itself, and the same name can
  -- only ever be written once — see the unique index below.
  idempotency_key    text not null,

  description        text,
  metadata           jsonb not null default '{}'::jsonb,
  created_by         uuid references public.dd_users(id) on delete set null,
  created_at         timestamptz not null default now()
);

-- THE duplicate guard. A retried POS post, a replayed offline queue entry, a
-- double-tapped Apply, a webhook delivered twice — all of them arrive with
-- the same key and the second one loses.
create unique index if not exists dd_cash_ledger_idem_uniq
  on public.dd_cash_ledger (idempotency_key);

create index if not exists dd_cash_ledger_customer_idx on public.dd_cash_ledger (customer_id, created_at desc);
create index if not exists dd_cash_ledger_shop_idx     on public.dd_cash_ledger (shop_id, created_at desc);
create index if not exists dd_cash_ledger_order_idx    on public.dd_cash_ledger (order_id);
-- Settlement reads: "what does shop A owe shop B".
create index if not exists dd_cash_ledger_settle_idx
  on public.dd_cash_ledger (funding_shop_id, redeeming_shop_id, created_at)
  where funding_shop_id is distinct from redeeming_shop_id;

-- Immutability. The ledger is an accounting record; correcting it means
-- adding a compensating row, never editing history.
create or replace function public.dd_cash_ledger_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'dd_cash_ledger is append-only (attempted % on %)', tg_op, old.id;
end;
$$;

drop trigger if exists dd_cash_ledger_no_update on public.dd_cash_ledger;
create trigger dd_cash_ledger_no_update
  before update or delete on public.dd_cash_ledger
  for each row execute function public.dd_cash_ledger_immutable();

-- ─────────────────────────────────────────────────────────────────────────
-- Redemption applied to an order
-- ─────────────────────────────────────────────────────────────────────────
-- A NEW column, deliberately not folded into discount_amount. The orders
-- route recomputes the total from its parts and refuses a sale whose parts
-- disagree; discount_amount already has a meaning in that sum and in every
-- report built on it. Overloading it would misstate discounts and silently
-- change what the existing validation is checking.
alter table public.dd_orders
  add column if not exists cash_redeemed_cents integer not null default 0
    check (cash_redeemed_cents >= 0);

-- ─────────────────────────────────────────────────────────────────────────
-- Security
-- ─────────────────────────────────────────────────────────────────────────
alter table public.dd_cash_wallets enable row level security;
alter table public.dd_cash_ledger  enable row level security;

-- Customers read their own wallet and history. Nobody writes anything: there
-- is deliberately no insert/update/delete policy on either table, so the only
-- way a balance moves is through the security-definer functions below.
drop policy if exists dd_cash_wallets_self_read on public.dd_cash_wallets;
create policy dd_cash_wallets_self_read on public.dd_cash_wallets
  for select using (
    customer_id in (select id from public.dd_users where auth_id = auth.uid())
  );

drop policy if exists dd_cash_ledger_self_read on public.dd_cash_ledger;
create policy dd_cash_ledger_self_read on public.dd_cash_ledger
  for select using (
    customer_id in (select id from public.dd_users where auth_id = auth.uid())
  );

-- Staff reach wallets through the POS API with the service-role key, which
-- bypasses RLS. That is on purpose: the API checks the caller is active staff
-- at the shop before it looks anything up, and it returns a balance rather
-- than table access. A shop owner holding an anon key gets nothing here.

-- ─────────────────────────────────────────────────────────────────────────
-- Engine
-- ─────────────────────────────────────────────────────────────────────────
-- All three functions are SECURITY DEFINER with a pinned search_path, take
-- their own advisory lock on the wallet, and write the wallet and the ledger
-- in one statement each. A partial failure cannot leave a balance that no row
-- explains.
--
-- Each is idempotent on a key it derives itself. Calling any of them twice
-- for the same event is a no-op that returns the first result, which is what
-- makes the offline queue, POS retries and double taps safe.

create or replace function public.dd_cash_wallet_for(p_customer uuid)
returns public.dd_cash_wallets
language plpgsql security definer set search_path = public as $$
declare w public.dd_cash_wallets;
begin
  insert into public.dd_cash_wallets (customer_id)
  values (p_customer)
  on conflict (customer_id) do nothing;
  select * into w from public.dd_cash_wallets where customer_id = p_customer;
  return w;
end;
$$;

-- What a sale is allowed to earn on: merchandise actually paid for with
-- money. Tax, tip, delivery and service fees are excluded because they are
-- not the shop's margin; every discount is excluded because it was never
-- charged; and the Cash redeemed on this order is excluded because rewarding
-- it would pay a reward on a reward.
create or replace function public.dd_cash_eligible_cents(o public.dd_orders)
returns bigint language sql immutable as $$
  select greatest(
    0,
    round(coalesce(o.subtotal, 0) * 100)::bigint       -- GROSS merchandise
    - round(coalesce(o.discount_amount, 0) * 100)::bigint
    - round(coalesce(o.cash_discount_amount, 0) * 100)::bigint
    - round(coalesce(o.promo_discount, 0) * 100)::bigint
    - coalesce(o.cash_redeemed_cents, 0)::bigint
  );
$$;

-- EARN. Called once, server-side, after an order is recorded.
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

  -- Only a finished sale earns; a cancelled one must not.
  --
  -- These are the statuses the platform ACTUALLY writes, checked against the
  -- live table: 775 'delivered', 1 'picked_up', 10 'cancelled', and nothing
  -- else. The obvious-sounding 'completed' / 'paid' / 'fulfilled' appear
  -- nowhere, and gating on them would have quietly awarded nothing at all
  -- while looking perfectly correct.
  if coalesce(o.status, '') not in ('delivered', 'picked_up') then
    return null;
  end if;

  select * into s from public.dd_shops where id = o.shop_id;
  if not found or not coalesce(s.rewards_enabled, false) then return null; end if;

  v_eligible := public.dd_cash_eligible_cents(o);
  if v_eligible < coalesce(s.reward_min_purchase_cents, 0) then return null; end if;

  w := public.dd_cash_wallet_for(o.customer_id);
  perform pg_advisory_xact_lock(hashtextextended(w.id::text, 0));
  -- Re-read UNDER the lock. The row above was fetched before it, so two
  -- registers ringing the same customer at once would both compute from the
  -- same stale balance and the second write would clobber the first.
  select * into w from public.dd_cash_wallets where id = w.id;

  -- First eligible purchase earns the new-customer rate. Judged on whether
  -- any EARN has ever been written, not on the wallet balance — a customer
  -- who earned and spent everything is not new.
  if exists (select 1 from public.dd_cash_ledger
             where customer_id = o.customer_id and transaction_type = 'EARN') then
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

-- REDEEM. Called when the cashier applies Cash to a sale in progress, BEFORE
-- payment, so the remaining balance flows through the existing tender path.
--
-- The amount the client asks for is a request, not an instruction: it is
-- clamped to the balance, to the eligible merchandise, and to the shop's
-- per-order cap. A client that asks for $1,000 gets whatever is actually
-- available and no error, because the cashier should not have to care.
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
  v_funding uuid;
  v_row public.dd_cash_ledger;
begin
  select * into v_existing from public.dd_cash_ledger where idempotency_key = v_key;
  if found then return v_existing; end if;

  select * into s from public.dd_shops where id = p_shop_id;
  if not found or not coalesce(s.rewards_enabled, false) then return null; end if;

  w := public.dd_cash_wallet_for(p_customer);
  perform pg_advisory_xact_lock(hashtextextended(w.id::text, 0));
  -- Re-read under the lock: two registers can ring the same customer at once.
  select * into w from public.dd_cash_wallets where id = w.id;

  select * into o from public.dd_orders where id = p_order_id;
  -- Pre-payment the order may not exist yet, in which case the caller passes
  -- the eligible figure through metadata and we trust the clamp below.
  v_eligible := case when found then public.dd_cash_eligible_cents(o) else p_requested_cents end;

  v_amount := least(
    greatest(p_requested_cents, 0),
    w.balance_cents,
    v_eligible,
    coalesce(s.reward_max_redeem_cents, p_requested_cents)
  );
  if v_amount <= 0 then return null; end if;

  -- Whose money is being spent. Oldest-funded first would need per-lot
  -- tracking; for now the EARN rows carry the funding shop and settlement
  -- reads them in order. Recorded here so the redemption side is attributable
  -- even before settlement exists.
  select funding_shop_id into v_funding
    from public.dd_cash_ledger
   where customer_id = p_customer and transaction_type = 'EARN'
     and funding_shop_id is not null
   order by created_at
   limit 1;

  -- Cross-store acceptance is a shop setting. A shop that has not opted in
  -- only honours Cash it funded itself.
  if v_funding is not null and v_funding <> p_shop_id
     and not coalesce(s.reward_cross_store_enabled, false) then
    return null;
  end if;

  insert into public.dd_cash_ledger (
    customer_id, wallet_id, transaction_type, amount_cents, balance_after_cents,
    order_id, shop_id, funding_shop_id, redeeming_shop_id,
    idempotency_key, description
  ) values (
    p_customer, w.id, 'REDEEM', -v_amount, w.balance_cents - v_amount,
    p_order_id, p_shop_id, v_funding, p_shop_id,
    v_key, 'DonutDash Cash applied'
  ) returning * into v_row;

  update public.dd_cash_wallets
     set balance_cents           = balance_cents - v_amount,
         lifetime_redeemed_cents = lifetime_redeemed_cents + v_amount,
         updated_at              = now()
   where id = w.id;

  return v_row;
end;
$$;

-- REFUND_REVERSAL. Takes back the share of a reward that belongs to refunded
-- merchandise.
--
-- Keyed on the CUMULATIVE refund figure, because dd_orders.refund_amount is a
-- running total: a second partial refund produces a different key and so a
-- second reversal, while re-running the same refund produces the same key and
-- does nothing. Each reversal only ever takes the increment.
create or replace function public.dd_cash_reverse_refund(p_order_id uuid)
returns public.dd_cash_ledger
language plpgsql security definer set search_path = public as $$
declare
  o public.dd_orders;
  w public.dd_cash_wallets;
  v_earn public.dd_cash_ledger;
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

  w := public.dd_cash_wallet_for(v_earn.customer_id);
  perform pg_advisory_xact_lock(hashtextextended(w.id::text, 0));
  select * into w from public.dd_cash_wallets where id = w.id;

  -- Proportion of the eligible merchandise handed back. Capped at 1 because
  -- a refund can exceed the eligible base once tax and tip are in it.
  v_share := least(1.0, v_refunded_cents::numeric / v_earn.eligible_cents::numeric);
  -- Reverse against the GROSS reward, not what reached the balance: a reward
  -- partly swallowed by an earlier offset was still earned on this sale.
  v_target := round(coalesce((v_earn.metadata->>'gross_cents')::bigint, v_earn.amount_cents) * v_share);

  select coalesce(-sum(amount_cents), 0) into v_already
    from public.dd_cash_ledger
   where order_id = p_order_id and transaction_type = 'REFUND_REVERSAL';

  v_claw := v_target - v_already;
  if v_claw <= 0 then return null; end if;

  -- Take what is there; the rest becomes a debt against future earnings
  -- rather than a negative balance. This is the policy decision: the customer
  -- is never shown a negative number and the shop does not write the money
  -- off — it comes back out of what they earn next.
  v_from_balance := least(v_claw, w.balance_cents);
  v_to_offset    := v_claw - v_from_balance;

  insert into public.dd_cash_ledger (
    customer_id, wallet_id, transaction_type, amount_cents, balance_after_cents,
    order_id, shop_id, funding_shop_id, idempotency_key, description, metadata
  ) values (
    v_earn.customer_id, w.id, 'REFUND_REVERSAL', -v_from_balance,
    w.balance_cents - v_from_balance,
    p_order_id, o.shop_id, v_earn.funding_shop_id, v_key,
    'Reversed after refund on order ' || coalesce(o.short_code, o.id::text),
    jsonb_build_object(
      'refunded_cents', v_refunded_cents,
      'share', v_share,
      'clawback_cents', v_claw,
      'deferred_to_offset_cents', v_to_offset
    )
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
-- Reconciliation — the ledger must explain the wallet, always
-- ─────────────────────────────────────────────────────────────────────────
-- Any row returned by this view is a bug. Worth a scheduled check once this
-- is carrying real money.
create or replace view public.dd_cash_wallet_drift as
  select w.customer_id,
         w.balance_cents                       as wallet_cents,
         coalesce(sum(l.amount_cents), 0)      as ledger_cents,
         w.balance_cents - coalesce(sum(l.amount_cents), 0) as drift_cents
    from public.dd_cash_wallets w
    left join public.dd_cash_ledger l on l.wallet_id = w.id
   group by w.customer_id, w.balance_cents
  having w.balance_cents <> coalesce(sum(l.amount_cents), 0);

-- ─────────────────────────────────────────────────────────────────────────
-- Conversion from the points programme
-- ─────────────────────────────────────────────────────────────────────────
-- 1 point = 1 cent, agreed 2026-10-07. Points were earned at 1 per $1 spent,
-- so holders effectively earned 1% and keep that as Cash. 250 points were
-- outstanding across six customers at the time of writing — $2.50 in total,
-- $1.38 for the largest holder.
--
-- Written as ADMIN_ADJUSTMENT ledger rows rather than seeded balances,
-- because rule 2 says the ledger explains the wallet and a balance that
-- appeared from nowhere would be indistinguishable from a bug.
--
-- Idempotent on the user, so re-running this file cannot pay anyone twice.
--
-- dd_loyalty and dd_loyalty_transactions are NOT dropped. They are the
-- evidence for these adjustments, and nothing is reversible once a table
-- carrying customer money is gone. Retire them once the new programme has
-- run a full refund cycle in production.
do $$
declare r record; w public.dd_cash_wallets; v_key text;
begin
  for r in
    select l.user_id, l.points
      from public.dd_loyalty l
      join public.dd_users u on u.id = l.user_id
     where l.points > 0
  loop
    v_key := 'convert:loyalty:' || r.user_id::text;
    if exists (select 1 from public.dd_cash_ledger where idempotency_key = v_key) then
      continue;
    end if;

    w := public.dd_cash_wallet_for(r.user_id);

    insert into public.dd_cash_ledger (
      customer_id, wallet_id, transaction_type, amount_cents, balance_after_cents,
      idempotency_key, description, metadata
    ) values (
      r.user_id, w.id, 'ADMIN_ADJUSTMENT', r.points, w.balance_cents + r.points,
      v_key,
      'Converted from loyalty points at 1 point = 1 cent',
      jsonb_build_object('points', r.points, 'rate', '1 point = 1 cent')
    );

    update public.dd_cash_wallets
       set balance_cents         = balance_cents + r.points,
           lifetime_earned_cents = lifetime_earned_cents + r.points,
           updated_at            = now()
     where id = w.id;
  end loop;
end $$;
