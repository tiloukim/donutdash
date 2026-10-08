-- A record that a card charge was ATTEMPTED, written before the terminal is
-- touched.
--
-- Today the only trace of a card sale is the dd_orders row written AFTER the
-- terminal approves. I checked for a charge log under eight plausible names
-- and there is none. So when a charge approves and the order write does not
-- happen, the money is gone from the customer, present in the processor's
-- settlement, and absent from DonutDash entirely — with nothing on our side
-- that even knows to look. That is the shape of "a few transactions missing
-- on the POS but showing on the iPOSpays portal".
--
-- The register already guards the other half of this: after approval it
-- writes the order into its local offline queue before posting, so a crash
-- mid-submit replays later. What that cannot do is survive the tablet — a
-- wipe, a reinstall, a dead device — and it leaves the SERVER with no idea a
-- charge ever existed, which is why reconciling against the processor is
-- impossible from our side.
--
-- This table makes the attempt itself durable and server-side. If the
-- processor has a transaction we do not, there is now a row here naming it.
--
-- Note what makes this workable: if iPOSpays has the charge, the register had
-- connectivity when it ran. So a pre-charge write reaches the server in
-- exactly the cases we are trying to catch. It is still best-effort — see the
-- API route — because a reconciliation record must never be able to stop a
-- sale.

begin;

create table if not exists public.dd_pos_charge_intents (
  id                uuid primary key default gen_random_uuid(),
  -- The same key the order will carry. One sale, one key, from before the
  -- card is read to after the row is written: that is what lets the two be
  -- matched without guessing on amount and timestamp.
  client_order_id   text        not null unique,
  shop_id           uuid        not null references public.dd_shops(id) on delete cascade,
  staff_id          uuid        references public.dd_users(id) on delete set null,
  -- What we were about to ask for, in cents. Recorded before the terminal
  -- answers, so it is what the register intended rather than what settled.
  amount_cents      bigint      not null,

  -- ── filled in when the terminal answers, best effort ──
  approved          boolean,
  auth_code         text,
  ref_number        text,
  card_last4        text,
  -- What the terminal actually took, which can differ from amount_cents once
  -- an on-terminal tip or surcharge is added.
  charged_cents     bigint,
  terminal_at       timestamptz,

  -- ── filled in when the order finally lands ──
  order_id          uuid        references public.dd_orders(id) on delete set null,
  resolved_at       timestamptz,

  created_at        timestamptz not null default now()
);

create index if not exists dd_pos_charge_intents_shop_idx
  on public.dd_pos_charge_intents (shop_id, created_at desc);

-- The query this table exists to answer, kept cheap.
create index if not exists dd_pos_charge_intents_open_idx
  on public.dd_pos_charge_intents (created_at)
  where order_id is null and approved is true;

alter table public.dd_pos_charge_intents enable row level security;

-- ─────────────────────────────────────────────────────────────────────────
-- Money taken with no sale recorded
-- ─────────────────────────────────────────────────────────────────────────
-- Approved by the terminal, never matched to an order, and old enough that a
-- slow network or a replay from the offline queue has had its chance. The
-- fifteen minutes matters: without it this view would be full of sales that
-- are merely mid-flight, and a reconciliation report that cries wolf gets
-- ignored, which is the same as not having one.
create or replace view public.dd_pos_unrecorded_charges as
  select i.id,
         i.client_order_id,
         i.shop_id,
         s.name                                   as shop_name,
         i.staff_id,
         coalesce(i.charged_cents, i.amount_cents) as cents,
         i.auth_code,
         i.ref_number,
         i.card_last4,
         i.terminal_at,
         i.created_at,
         now() - i.created_at                      as age
    from public.dd_pos_charge_intents i
    join public.dd_shops s on s.id = i.shop_id
   where i.approved is true
     and i.order_id is null
     and i.created_at < now() - interval '15 minutes'
   order by i.created_at desc;

commit;
