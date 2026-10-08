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
-- Idempotent: safe to run twice. Every step checks for its own effect first.

begin;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. The shop that legacy, shop-less rows belong to
-- ─────────────────────────────────────────────────────────────────────────
-- The points conversion wrote ADMIN_ADJUSTMENT rows with no shop_id, because
-- the points programme was platform-wide. Those balances have to land
-- somewhere, and the only defensible answer is the shop where they can
-- actually be spent — which is only unambiguous while exactly one shop runs
-- the programme. If a second shop has joined by the time this runs, stop:
-- splitting someone's balance across shops is a decision for a person, not a
-- migration guessing in the dark.
do $$
declare v_n integer;
begin
  select count(*) into v_n from public.dd_shops where coalesce(rewards_enabled,false);
  if v_n <> 1 and exists (
    select 1 from public.dd_cash_ledger where shop_id is null
  ) then
    raise exception
      'Cannot place % shop-less ledger rows: % shops run rewards, so the target is ambiguous. Assign shop_id by hand first.',
      (select count(*) from public.dd_cash_ledger where shop_id is null), v_n;
  end if;
end $$;

update public.dd_cash_ledger
   set shop_id = (select id from public.dd_shops where coalesce(rewards_enabled,false) limit 1)
 where shop_id is null;

-- Funding follows: money adjusted in at a shop was funded by that shop.
update public.dd_cash_ledger
   set funding_shop_id = shop_id
 where funding_shop_id is null
   and transaction_type in ('EARN', 'ADMIN_ADJUSTMENT')
   and amount_cents > 0;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Wallets gain a shop
-- ─────────────────────────────────────────────────────────────────────────
alter table public.dd_cash_wallets
  add column if not exists shop_id uuid references public.dd_shops(id) on delete cascade;

-- A wallet can only be stamped with a shop if all of its ledger belongs to
-- one. Refuse rather than mangle: if a pooled wallet really does hold money
-- from two shops, it must be SPLIT, and that is a separate, deliberate script.
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

update public.dd_cash_wallets w
   set shop_id = (
     select l.shop_id from public.dd_cash_ledger l
      where l.wallet_id = w.id and l.shop_id is not null
      limit 1
   )
 where w.shop_id is null;

-- A wallet with no ledger at all has nothing to infer from and nothing in it.
delete from public.dd_cash_wallets
 where shop_id is null
   and balance_cents = 0
   and not exists (select 1 from public.dd_cash_ledger l where l.wallet_id = id);

do $$
begin
  if exists (select 1 from public.dd_cash_wallets where shop_id is null) then
    raise exception 'Some wallets still have no shop and a non-zero balance; refusing to add NOT NULL.';
  end if;
end $$;

alter table public.dd_cash_wallets alter column shop_id set not null;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. One wallet per customer PER SHOP
-- ─────────────────────────────────────────────────────────────────────────
-- Drop whatever unique constraint or index currently pins customer_id alone,
-- by lookup rather than by a guessed name.
do $$
declare r record;
begin
  for r in
    select c.conname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
     where t.relname = 'dd_cash_wallets' and c.contype = 'u'
       and (select array_agg(a.attname order by a.attname)
              from pg_attribute a
             where a.attrelid = t.oid and a.attnum = any(c.conkey)) = array['customer_id']
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
