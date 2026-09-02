-- Card surcharge / card-fee program
--
-- Replaces the hardcoded `const cardSurchargePct = 4` in the POS checkout
-- with per-shop config, and gives the fee a real column instead of leaving
-- it folded into dd_orders.total.
--
-- Background: the POS assumed a 4% fee program was live on the terminal and
-- displayed it, but never sent it — and lib/hardware/pax/ipospays.ts
-- fabricated the same 4% whenever the gateway returned no Surcharge tag.
-- With no fee program actually enabled on the TPN, a $1.35 sale charged
-- $1.35 but was printed and booked as $1.40. Two fixes: the app now only
-- ever trusts a gateway-reported fee, and the rate lives here.
--
-- Run in Supabase SQL editor.

-- ── Per-shop rate ───────────────────────────────────────────────────
-- The fee is percentage + flat, because processors quote it that way
-- (e.g. 3.5% + $0.15 per swipe/dip/tap). Either component may be 0.
-- Both default to 0 so no shop starts charging a fee by accident —
-- enabling one is an explicit, per-shop decision.

alter table public.dd_shops
  add column if not exists card_surcharge_pct numeric(5,2) not null default 0.00;

alter table public.dd_shops
  add column if not exists card_surcharge_flat numeric(6,2) not null default 0.00;

alter table public.dd_shops
  drop constraint if exists dd_shops_card_surcharge_pct_range;
-- Visa caps surcharges at 3%, Mastercard at 4%. The ceiling here is a
-- guardrail against a typo (35 instead of 3.5), not legal advice — a shop
-- running a *cash discount* program instead is not bound by these caps.
alter table public.dd_shops
  add constraint dd_shops_card_surcharge_pct_range
  check (card_surcharge_pct >= 0.00 and card_surcharge_pct <= 4.00);

alter table public.dd_shops
  drop constraint if exists dd_shops_card_surcharge_flat_range;
alter table public.dd_shops
  add constraint dd_shops_card_surcharge_flat_range
  check (card_surcharge_flat >= 0.00 and card_surcharge_flat <= 1.00);

comment on column public.dd_shops.card_surcharge_pct is
  'Percentage component of the card fee passed to the customer (e.g. 3.50 for 3.5%). 0 = no percentage fee. Only meaningful when card_surcharge_mode is not ''none''.';

comment on column public.dd_shops.card_surcharge_flat is
  'Flat per-transaction component of the card fee in dollars (e.g. 0.15 per swipe/dip/tap). 0 = no flat fee. Note this dominates on small tickets: $0.15 on a $1.25 sale is 12% by itself.';

-- ── Who applies the fee ─────────────────────────────────────────────
-- The critical distinction, and the source of the original bug:
--
--   'none'     no fee program. POS sends the plain amount, displays no
--              fee, and records 0. This is the safe default.
--
--   'terminal' the processor's fee program (iPOSpays "Fee" tab) adds the
--              fee on top of the Amount the POS sends. The POS must NOT
--              add it — it only displays it and reads the real figure
--              back from the gateway's Surcharge/Custom/CustomFee tag.
--
--   'pos'      the terminal treats the sent Amount as final, so the POS
--              computes the fee itself and includes it in Amount.
--
-- Getting this backwards either double-charges the customer ('terminal'
-- when the POS also adds it) or silently under-collects while the receipt
-- claims otherwise (what actually happened here).

do $$
begin
  if not exists (select 1 from pg_type where typname = 'dd_card_surcharge_mode') then
    create type public.dd_card_surcharge_mode as enum ('none', 'terminal', 'pos');
  end if;
end$$;

alter table public.dd_shops
  add column if not exists card_surcharge_mode public.dd_card_surcharge_mode
  not null default 'none';

comment on column public.dd_shops.card_surcharge_mode is
  'Who applies the card fee. ''none'' = no fee program (default). ''terminal'' = the processor adds it on top of the amount the POS sends; the POS displays it but never adds it. ''pos'' = the terminal treats the sent amount as final, so the POS computes the fee and includes it. Confirm with the processor which one the TPN is configured for before switching off ''none''.';

-- ── Per-order snapshot ──────────────────────────────────────────────
-- Until now the surcharge had no column: app/api/pos/orders/route.ts folded
-- it into `total` and left a TODO saying reports should derive it as
-- (total - subtotal - tax - tip + cash_discount). That made the 4% drift
-- invisible in reports and reconstructable only by arithmetic. Store it.

alter table public.dd_orders
  add column if not exists card_surcharge_amount numeric(10,2) not null default 0.00;

comment on column public.dd_orders.card_surcharge_amount is
  'Card fee actually applied to this sale in dollars, as reported by the gateway (or computed by the POS in ''pos'' mode). Included in `total`. 0 for cash, manually-keyed cards, and any TPN without a fee program. Never estimated — a fee the gateway did not report is recorded as 0.';

-- ── Backfill note ───────────────────────────────────────────────────
-- Existing rows default to 0.00, which is correct: no fee program has ever
-- been live, so no historical order carried a real surcharge. The one order
-- that recorded a fabricated fee (short_code 18BB6, $1.61 → $1.55) was
-- already corrected by hand.
