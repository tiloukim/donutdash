-- Record the PERCENTAGE half of the processor's cut, not just the flat fee.
--
-- dd_pos_card_fees was written with `amount = dd_shops.pos_card_fee` (the
-- flat $0.15) and nothing else. But the processor's charge to the shop has
-- two halves — flat + dd_shops.pos_card_fee_pct (3.5% for Top Donuts) — so
-- the ledger, and /api/pos/card-fees/daily which reads it, understated the
-- real cut by 3.5% of card volume on every single sale.
--
-- Splitting the components out rather than only storing a bigger `amount`:
-- the flat and percentage halves are negotiated separately and change
-- separately, and a reconciliation row that can't show its own arithmetic is
-- exactly how the fabricated 4% surcharge survived as long as it did.
--
-- Run in the Supabase SQL editor.

alter table public.dd_pos_card_fees
  add column if not exists fee_flat    numeric(10,2),
  add column if not exists fee_pct     numeric(6,3),
  add column if not exists base_amount numeric(10,2);

comment on column public.dd_pos_card_fees.amount is
  'Total processor cut on this sale: fee_flat + (fee_pct% of base_amount). Rows written before 2026-09-15 hold the flat fee ONLY and understate the real cut — do not treat them as complete.';
comment on column public.dd_pos_card_fees.fee_flat is
  'Flat per-transaction fee (dd_shops.pos_card_fee) at the time of sale.';
comment on column public.dd_pos_card_fees.fee_pct is
  'Percentage fee (dd_shops.pos_card_fee_pct) at the time of sale, as a PERCENT: 3.5 = 3.5%.';
comment on column public.dd_pos_card_fees.base_amount is
  'Amount the percentage was applied to — the order total actually run on the card, surcharge and tip included, since the processor charges on what it settles.';

-- Deliberately NOT backfilling. pos_card_fee_pct was configured partway
-- through the period these rows cover, so any retroactive multiply would
-- invent a cut that was never charged. Historical rows stay as they are and
-- the comment above marks them incomplete.
