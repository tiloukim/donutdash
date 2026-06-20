-- Netevia payment ledger.
--
-- dd_orders already records the customer-facing sale (one row per cart).
-- dd_payments is the gateway-side ledger: one row per Netevia API call.
-- A normal sale produces 1 payments row (charge). A refunded sale has 2
-- (charge + refund). A reauthorized sale has 3 (auth + capture + capture).
-- Splitting them out is what makes reconciliation against Netevia's
-- daily settlement report possible — that report lists every API call
-- individually, not by order.
--
-- This file is additive — it does NOT replace dd_orders.card_* columns.
-- Those stay as the order-level snapshot for the receipt/transactions
-- UI. The dd_payments row is the source of truth for accounting.

-- ─────────────────────────────────────────────────────────────────────
-- dd_payment_batches — one row per settled batch per shop per day.
-- Defined first because dd_payments.batch_id references it. Reconciler
-- matches Netevia's batch report against the sum of dd_payments where
-- batch_id = this.id.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists dd_payment_batches (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references dd_shops(id) on delete restrict,

  -- Netevia's batch identifier from the settle response. Unique per
  -- merchant — if we ever see a duplicate batch number for a shop, it's
  -- a bug.
  netevia_batch_number text not null,

  -- Local date the batch was cut. Stored as date (not timestamptz)
  -- because Netevia's batch boundary is a Pacific-time cutoff, not a
  -- UTC instant — comparing as date avoids the off-by-one that comes
  -- from converting through UTC.
  batch_date date not null,

  -- Sums we computed from dd_payments at close time. The reconciler
  -- compares these to what Netevia reports the next morning; mismatch
  -- triggers an alert (we missed a webhook or double-counted).
  txn_count integer not null default 0,
  gross_cents integer not null default 0,
  refund_cents integer not null default 0,
  -- Net = gross - refunds - interchange fees. interchange_cents stays
  -- null until Netevia's daily report posts (T+1 morning).
  interchange_cents integer,
  net_cents integer,

  status text not null default 'open' check (status in (
    'open', 'closing', 'closed', 'reconciled', 'discrepancy'
  )),

  -- When the cashier hit Close Batch (or our nightly cron did it).
  closed_at timestamptz,
  -- When the reconciler matched us to Netevia's report.
  reconciled_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (shop_id, netevia_batch_number)
);

create index if not exists idx_dd_batches_shop_date on dd_payment_batches(shop_id, batch_date desc);

-- ─────────────────────────────────────────────────────────────────────
-- dd_payments — every charge / auth / capture / refund / void hitting
-- the gateway. Append-only from the app's perspective; the only mutation
-- is `status` (pending → approved/declined/voided) and the settlement
-- linkage when a batch closes.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists dd_payments (
  id uuid primary key default gen_random_uuid(),

  -- Which DonutDash sale this belongs to. Nullable because tokenization-
  -- only calls (saving a card without charging) have no order yet.
  order_id uuid references dd_orders(id) on delete set null,

  -- Multi-tenant safety. Without this we'd have to JOIN through dd_orders
  -- for every per-shop report, which gets painful once a refund's
  -- order_id is nulled by a deleted order.
  shop_id uuid not null references dd_shops(id) on delete restrict,

  -- What kind of gateway call this row represents. 'auth' = hold without
  -- capture (tip-adjust flow), 'capture' = settle a prior auth,
  -- 'charge' = sale (auth+capture in one), 'refund' = return funds,
  -- 'void' = cancel an auth before settlement. Stored as text (not enum)
  -- so adding 'incremental_auth' later doesn't require ALTER TYPE.
  kind text not null check (kind in ('charge', 'auth', 'capture', 'refund', 'void')),

  -- Lifecycle. pending = request in flight or webhook not yet received.
  -- approved/declined are terminal for the gateway's verdict; settled
  -- means the batch closed and funds are on the way; chargeback /
  -- chargeback_reversed are post-settlement disputes.
  status text not null default 'pending' check (status in (
    'pending', 'approved', 'declined', 'voided',
    'settled', 'chargeback', 'chargeback_reversed', 'error'
  )),

  -- Money in cents, USD only for now. Integer cents avoids the floating-
  -- point reconciliation drift that has bitten dd_orders historically.
  amount_cents integer not null check (amount_cents >= 0),
  tip_cents integer not null default 0 check (tip_cents >= 0),
  surcharge_cents integer not null default 0 check (surcharge_cents >= 0),
  currency text not null default 'USD',

  -- ── Netevia identifiers ────────────────────────────────────────────
  -- The gateway's unique txn id. Unique index below so a webhook replay
  -- can't insert a duplicate row.
  netevia_transaction_id text,
  -- Returned approval code, shown on receipts as "Auth: XXXXXX".
  netevia_auth_code text,
  -- Stored token if this was a vault save. Other rows reference it via
  -- netevia_token_used to enable card-on-file flows.
  netevia_token text,
  netevia_token_used text,
  -- Raw decline / error code from the gateway. Persisted verbatim so
  -- support can decode it against Netevia's response code reference.
  response_code text,
  response_message text,

  -- ── Card snapshot ──────────────────────────────────────────────────
  -- Denormalized for receipts/reporting. PAN itself is NEVER stored —
  -- only the last4 and brand the gateway echoes back.
  card_brand text,
  card_last4 text,
  -- 'present' = chip/tap on the P8, 'keyed' = manual entry (CNP risk),
  -- 'online' = web checkout token, 'recurring' = vault-on-file.
  entry_mode text check (entry_mode in ('present', 'keyed', 'online', 'recurring')),

  -- ── Linkage ────────────────────────────────────────────────────────
  -- For refunds/voids/captures: which dd_payments row they reference.
  -- ON DELETE RESTRICT because losing this link breaks reconciliation
  -- (a refund without its original charge can't be matched to Netevia's
  -- batch report).
  parent_payment_id uuid references dd_payments(id) on delete restrict,

  -- Which terminal physically ran the txn, if card-present. Null for
  -- web/online charges and for refunds initiated from the admin UI.
  terminal_tpn text,

  -- Which cashier ran it. dd_users.id (post-PIN-switch), not auth_id.
  cashier_user_id uuid references dd_users(id) on delete set null,

  -- ── Batch / settlement ─────────────────────────────────────────────
  -- Filled in when dd_payment_batches closes this txn over. Null until
  -- then — that's how the reconciliation job finds unsettled rows.
  batch_id uuid references dd_payment_batches(id) on delete set null,
  settled_at timestamptz,

  -- ── Audit ──────────────────────────────────────────────────────────
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- The webhook payload that flipped status last. Keeping a sample of
  -- the raw JSON makes debugging "why did this row end up declined"
  -- 10× easier than digging through Vercel logs after the fact.
  gateway_payload jsonb
);

-- Webhook idempotency. Netevia retries on non-2xx — without this a
-- replay would insert a duplicate ledger row and double-count the sale
-- in reports. Partial index because pending rows haven't received a
-- transaction id yet.
create unique index if not exists idx_dd_payments_netevia_txn_unique
  on dd_payments (netevia_transaction_id)
  where netevia_transaction_id is not null;

create index if not exists idx_dd_payments_order_id on dd_payments(order_id);
create index if not exists idx_dd_payments_shop_id_created on dd_payments(shop_id, created_at desc);
create index if not exists idx_dd_payments_status on dd_payments(status) where status in ('pending', 'chargeback');
create index if not exists idx_dd_payments_unsettled on dd_payments(shop_id, created_at)
  where status = 'approved' and batch_id is null;

-- ─────────────────────────────────────────────────────────────────────
-- dd_payment_refunds — denormalized refund records for the admin UI
-- and customer support tools. Every refund also has a dd_payments row
-- (kind='refund') — this table just adds the human-facing context.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists dd_payment_refunds (
  id uuid primary key default gen_random_uuid(),

  -- The dd_payments row representing the refund call itself.
  payment_id uuid not null references dd_payments(id) on delete cascade,
  -- The original charge being refunded. Convenience pointer; could be
  -- derived via dd_payments.parent_payment_id but joining twice is
  -- annoying in reports.
  original_payment_id uuid not null references dd_payments(id) on delete restrict,
  order_id uuid references dd_orders(id) on delete set null,

  amount_cents integer not null check (amount_cents > 0),

  -- Free-text reason captured at refund time. Required because cash-flow
  -- audits need to distinguish "customer complaint" from "duplicate charge"
  -- from "fraud chargeback prevention."
  reason text not null,

  -- Whether this was a full refund of the original charge. Computed at
  -- write time so the admin UI doesn't have to re-derive it on every list.
  is_full boolean not null,

  -- Who pressed Refund. dd_users.id after PIN switch, not auth_id.
  refunded_by uuid references dd_users(id) on delete set null,

  created_at timestamptz not null default now()
);

create index if not exists idx_dd_payment_refunds_order on dd_payment_refunds(order_id);
create index if not exists idx_dd_payment_refunds_original on dd_payment_refunds(original_payment_id);

-- ─────────────────────────────────────────────────────────────────────
-- Triggers — keep updated_at honest.
-- ─────────────────────────────────────────────────────────────────────
create or replace function dd_payments_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_dd_payments_updated_at on dd_payments;
create trigger trg_dd_payments_updated_at
  before update on dd_payments
  for each row execute function dd_payments_touch_updated_at();

drop trigger if exists trg_dd_payment_batches_updated_at on dd_payment_batches;
create trigger trg_dd_payment_batches_updated_at
  before update on dd_payment_batches
  for each row execute function dd_payments_touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- RLS off — same model as dd_shop_terminal_credentials. All access
-- routes through service-role API handlers that enforce shop_id auth.
-- Direct PostgREST to these tables would be a PCI scope expansion we
-- don't want, even though we never store PANs.
-- ─────────────────────────────────────────────────────────────────────
alter table dd_payment_batches disable row level security;
alter table dd_payments disable row level security;
alter table dd_payment_refunds disable row level security;
