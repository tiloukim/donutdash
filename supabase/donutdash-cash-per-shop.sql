-- DonutDash Cash becomes PER SHOP.
--
-- Until now there was one wallet per customer and one pooled balance across
-- every DonutDash shop, with a `reward_cross_store_enabled` flag meant to
-- police spending it elsewhere. That policing could not work, and the reason
-- is worth recording because the same shape will come back if anyone
-- reintroduces a shared balance:
--
--   A pooled balance has no composition. dd_cash_redeem tried to recover one
--   by reading the funding shop off the customer's OLDEST EARN row ever
--   (`order by created_at limit 1`) and treating that single shop as the
--   owner of the whole balance. So a customer with $1 earned at shop A and
--   $5 at shop B had one $6 balance attributed entirely to A — and shop B,
--   not opted into cross-store, would refuse to let them spend money shop B
--   had itself funded. Attribution cannot be reconstructed from one row; it
--   has to be a property of where the money is held.
--
-- Per-shop wallets make the question disappear. A balance earned at a shop is
-- held by that shop, spendable only there, and settled only with that shop.
-- Cross-store spending is not disabled by a flag — it is unrepresentable.
--
-- THE LEDGER IS NOT TOUCHED.
--
-- An earlier draft of this migration backfilled dd_cash_ledger.shop_id on the
-- legacy conversion rows and was refused by the database:
--
--   ERROR: dd_cash_ledger is append-only (attempted UPDATE on aa786fec-…)
--
-- which is the system working exactly as designed. The ledger is an
-- accounting record; correcting it means adding a compensating row, never
-- editing history, and a migration is not an exemption from that — if it were,
-- the guarantee would be worth nothing. Disabling the trigger to get the
-- UPDATE through would have been the easy fix and the wrong one.
--
-- So the shop is recorded on the WALLET, which is new and therefore has no
-- history to rewrite, and it is derived from the ledger rather than written
-- into it. The eight ADMIN_ADJUSTMENT rows from the points conversion keep
-- shop_id = null, which is honest: they were platform-wide points awarded
-- before per-shop accounting existed, and claiming otherwise would be
-- backdating a fact. The consequence to know about is that those rows are not
-- attributed in per-shop reporting, while the balances they funded now sit at
-- the shop assigned below. $1.65 across 5 wallets at the time of writing.
--
-- Idempotent: safe to run twice. Every step checks for its own effect first.

begin;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Wallets gain a shop
-- ─────────────────────────────────────────────────────────────────────────
alter table public.dd_cash_wallets
  add column if not exists shop_id uuid references public.dd_shops(id) on delete cascade;

-- A wallet can only be stamped with a shop if all of its ledger belongs to
-- one. Refuse rather than mangle: if a pooled wallet really does hold money
-- from two shops, it must be SPLIT, and that is a separate, deliberate script.
-- count(distinct) ignores nulls, so the legacy shop-less rows do not count as
-- a second shop here.
do $$
declare r record;
begin
  for r in
    select w.id, w.customer_id, count(distinct l.shop_id) as shops
      from public.dd_cash_wallets w
      join public.dd_cash_ledger l on l.wallet_id = w.id
     where w.shop_id is null
     group by w.id, w.customer_id
    having count(distinct l.shop_id) > 1
  loop
    raise exception
      'Wallet % (customer %) holds money from % different shops. A pooled balance cannot be stamped with one shop — split it first.',
      r.id, r.customer_id, r.shops;
  end loop;
end $$;

-- Derived from the ledger, not written into it.
update public.dd_cash_wallets w
   set shop_id = (
     select l.shop_id from public.dd_cash_ledger l
      where l.wallet_id = w.id and l.shop_id is not null
      limit 1
   )
 where w.shop_id is null;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Wallets whose only history is the shop-less points conversion
-- ─────────────────────────────────────────────────────────────────────────
-- These balances have to be spendable somewhere, and the only defensible
-- answer is the shop that actually runs the programme — which is unambiguous
-- only while exactly one does. If a second shop has joined by the time this
-- runs, stop: deciding whose liability someone's legacy balance becomes is a
-- decision for a person, not a migration guessing in the dark.
-- The guard matches exactly the set the fallback will touch: a wallet with no
-- shop that still has ledger history. Keying it on balance > 0 instead would
-- let a zero-balance wallet be handed an arbitrary shop by `limit 1` when more
-- than one is running the programme — harmless today, and precisely the kind
-- of arbitrary-but-silent assignment that is impossible to explain later.
do $$
declare v_n integer; v_need integer;
begin
  select count(*) into v_need
    from public.dd_cash_wallets w
   where w.shop_id is null
     and exists (select 1 from public.dd_cash_ledger l where l.wallet_id = w.id);
  if v_need > 0 then
    select count(*) into v_n from public.dd_shops where coalesce(rewards_enabled,false);
    if v_n <> 1 then
      raise exception
        'Cannot place % legacy wallet(s): % shops run rewards, so the target is ambiguous. Assign shop_id by hand first.',
        v_need, v_n;
    end if;
  end if;
end $$;

-- Aliased as `w`, and the subquery says w.id explicitly.
--
-- Written as `where l.wallet_id = id` this reads as l.wallet_id = l.id:
-- an unqualified column inside a subquery binds to the SUBQUERY's table
-- first, and dd_cash_ledger has an id of its own. The condition is then
-- never true, so this update would quietly do nothing and the NOT NULL
-- below would fail with no indication why.
update public.dd_cash_wallets w
   set shop_id = (select id from public.dd_shops where coalesce(rewards_enabled,false) limit 1)
 where w.shop_id is null
   and exists (select 1 from public.dd_cash_ledger l where l.wallet_id = w.id);

-- A wallet with no ledger at all has nothing to infer from and nothing in it.
--
-- The alias is not cosmetic here, it is the difference between deleting
-- nothing and deleting the accounting record. Unqualified, `id` binds to
-- dd_cash_ledger.id, so `not exists (… where l.wallet_id = l.id)` is true for
-- EVERY wallet — this would have deleted every zero-balance wallet including
-- ones with history, and dd_cash_ledger.wallet_id is ON DELETE CASCADE, so
-- their ledger rows would have gone with them. The append-only trigger that
-- refused this migration's first draft does not fire on a cascade.
delete from public.dd_cash_wallets w
 where w.shop_id is null
   and w.balance_cents = 0
   and not exists (select 1 from public.dd_cash_ledger l where l.wallet_id = w.id);

do $$
begin
  if exists (select 1 from public.dd_cash_wallets where shop_id is null) then
    raise exception 'Some wallets still have no shop; refusing to add NOT NULL.';
  end if;
end $$;

alter table public.dd_cash_wallets alter column shop_id set not null;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. One wallet per customer PER SHOP
-- ─────────────────────────────────────────────────────────────────────────
-- Drop the unique constraint that pins customer_id alone.
--
-- The name is not a guess: a deliberately-duplicate insert against the live
-- table reported `duplicate key value violates unique constraint
-- "dd_cash_wallets_customer_id_key"`, which is also the name Postgres
-- generates for a column-level UNIQUE. The catalog sweep after it is the
-- belt-and-braces for a database where it was renamed.
alter table public.dd_cash_wallets
  drop constraint if exists dd_cash_wallets_customer_id_key;

do $$
declare r record;
begin
  for r in
    -- Matched on conkey, which is smallint[], against array[attnum], also
    -- smallint[]. An earlier version compared array_agg(a.attname) to
    -- array['customer_id'] and failed outright with "operator does not exist:
    -- name[] = text[]" — attname is `name`, not text, and there is no
    -- equality operator between those array types.
    select c.conname
      from pg_constraint c
     where c.conrelid = 'public.dd_cash_wallets'::regclass
       and c.contype = 'u'
       and c.conkey = (
         select array[a.attnum]
           from pg_attribute a
          where a.attrelid = 'public.dd_cash_wallets'::regclass
            and a.attname = 'customer_id'
       )
  loop
    execute format('alter table public.dd_cash_wallets drop constraint %I', r.conname);
  end loop;
end $$;

drop index if exists dd_cash_wallets_customer_id_key;

create unique index if not exists dd_cash_wallets_customer_shop_uidx
  on public.dd_cash_wallets (customer_id, shop_id);

create index if not exists dd_cash_wallets_shop_idx
  on public.dd_cash_wallets (shop_id);

commit;
