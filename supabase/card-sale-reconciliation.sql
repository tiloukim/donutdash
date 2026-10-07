-- Card sales that the processor has and the POS doesn't.
--
-- On 7 Oct 2026 a $3.36 Discover sale was approved on the terminal, landed
-- in batch 029 and showed in the iPOSpays portal, and never reached the POS.
-- The day read 3 card sales / $49.06 against the terminal's 4 / $52.42.
-- Nothing in the system noticed; the owner found it by eye.
--
-- Two gaps let that happen, and this migration backs the fix for both.
--
-- 1. The register charges the card BEFORE it posts the order, so a server
--    rejection after a successful charge takes the money and keeps no
--    record. The route's own comment records the same thing happening to
--    order 46ADB. The register retries timeouts but not 4xx, so a rejected
--    sale is dropped for good. dd_orders.reconcile_flag lets the route
--    accept a charged sale it would otherwise refuse, and say so loudly.
--
-- 2. Nothing compares the POS against the processor. The Netevia webhook
--    only covers a gateway that isn't live; the terminal channel
--    (SPIn → iPays → TSYS) has no feed and no reconciliation job.
--    dd_processor_transactions is where the processor's own record lands
--    so the two can be compared.

-- ── 1. Orders accepted despite a disagreement ──────────────────────────

alter table public.dd_orders
  add column if not exists reconcile_flag text,
  add column if not exists reconcile_note text,
  add column if not exists reconcile_alerted_at timestamptz;

comment on column public.dd_orders.reconcile_flag is
  'Set when the order was recorded despite failing a check — today only ''total_mismatch'', meaning the card was already charged so refusing the sale would have lost it. Null on a clean sale.';
comment on column public.dd_orders.reconcile_note is
  'Human-readable detail for reconcile_flag: the client and server figures that disagreed.';
comment on column public.dd_orders.reconcile_alerted_at is
  'When an admin was told. One alert per order, so the cron can run often without becoming noise.';

create index if not exists dd_orders_reconcile_flag_idx
  on public.dd_orders (reconcile_flag, created_at desc)
  where reconcile_flag is not null;

-- Matching a processor transaction to an order is done on the auth code
-- and the gateway reference, so both need to be searchable.
create index if not exists dd_orders_card_auth_code_idx
  on public.dd_orders (shop_id, card_auth_code)
  where card_auth_code is not null;
create index if not exists dd_orders_card_ref_number_idx
  on public.dd_orders (shop_id, card_ref_number)
  where card_ref_number is not null;

-- ── 2. What the processor says happened ────────────────────────────────

create table if not exists public.dd_processor_transactions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.dd_shops(id) on delete set null,

  -- Terminal profile number. The only identifier present on every feed
  -- payload, and how a transaction is traced back to a shop when the feed
  -- doesn't name one.
  tpn text,
  batch_number text,

  amount_cents integer,
  auth_code text,
  ref_number text,
  card_brand text,
  card_last4 text,
  entry_mode text,
  transaction_type text,
  occurred_at timestamptz,

  -- The processor's own id for the transaction. Unique where present, so a
  -- feed that delivers at-least-once can't create duplicates.
  processor_transaction_id text,
  -- The id the register generated when it started the sale (the portal
  -- shows these as 'pos-<epoch ms>'). Present only on POS-initiated sales,
  -- and the strongest match there is.
  external_id text,

  -- The payload as received, with any run of 12+ digits masked: card
  -- numbers must not land in a reporting table, while amounts, auth codes
  -- and timestamps have to survive to be useful. Kept because the feed's
  -- field names are not documented — the first real payloads are how we
  -- learn the shape, the same way last_spin_shape was used for SPIn.
  raw_payload jsonb,

  source text not null default 'feed',
  status text not null default 'unmatched',
  matched_order_id uuid references public.dd_orders(id) on delete set null,
  matched_by text,
  alerted_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.dd_processor_transactions is
  'Card transactions as the processor reports them, independent of what the POS recorded. A row with status=''unmatched'' is money taken that the POS cannot account for.';
comment on column public.dd_processor_transactions.status is
  '''matched'' — tied to a dd_orders row. ''unmatched'' — no POS order found; this is the alarm. ''ignored'' — deliberately dismissed by an admin.';
comment on column public.dd_processor_transactions.matched_by is
  'Which rule matched: external_id, auth_code, ref_number or amount_time. Records how much to trust the match.';

create unique index if not exists dd_processor_transactions_txn_id_key
  on public.dd_processor_transactions (processor_transaction_id)
  where processor_transaction_id is not null;
create unique index if not exists dd_processor_transactions_external_id_key
  on public.dd_processor_transactions (external_id)
  where external_id is not null;
create index if not exists dd_processor_transactions_unmatched_idx
  on public.dd_processor_transactions (status, occurred_at desc)
  where status = 'unmatched';

alter table public.dd_processor_transactions enable row level security;

-- Service role only. The feed writes it, the cron reads it, and nothing
-- reaches it from a browser session — there is no policy here on purpose.
