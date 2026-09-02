-- Merchant-side card processing rate (percentage component)
--
-- The PROCESSOR (Netevia / iPOSpays) charges the shop 3.5% + $0.15 on every
-- card sale and deducts it from the deposit. This is a COST to the shop, not
-- DonutDash revenue — it is deliberately NOT written to the dd_pos_card_fees
-- ledger, which exists to bill the shop on DonutDash's behalf.
--
-- The flat $0.15 half already exists as dd_shops.pos_card_fee; this adds the
-- percentage half so sales reports can show a real Net Sales figure instead of
-- deducting only the flat fee.
--
-- THREE DIFFERENT FEES live on dd_shops. They are one careless glance apart,
-- so spelling them out:
--
--   card_surcharge_pct   3.00   CUSTOMER pays. Added to the charge at the
--                               register (see supabase/card-surcharge.sql).
--   pos_card_fee_pct     3.50   MERCHANT pays the PROCESSOR. % of card volume.
--   pos_card_fee         0.15   MERCHANT pays. Flat, per card transaction.
--
-- Note the customer surcharge (3%) does NOT cover the merchant cost
-- (3.5% + $0.15) — it under-recovers on every ticket and the gap widens with
-- size, because 3% < 3.5% and nothing on the customer side offsets the flat
-- component. Visa caps surcharges at 3%, so this cannot be closed by raising
-- the customer rate.
--
-- Run in Supabase SQL editor.

alter table public.dd_shops
  add column if not exists pos_card_fee_pct numeric(5,2) not null default 0.00;

alter table public.dd_shops
  drop constraint if exists dd_shops_pos_card_fee_pct_range;
-- Ceiling is a typo guard (35 instead of 3.5), not a business limit.
alter table public.dd_shops
  add constraint dd_shops_pos_card_fee_pct_range
  check (pos_card_fee_pct >= 0.00 and pos_card_fee_pct <= 10.00);

comment on column public.dd_shops.pos_card_fee_pct is
  'Percentage component of the card processing fee the PROCESSOR charges the SHOP on card volume (e.g. 3.50 for 3.5%), deducted from the deposit. Pairs with pos_card_fee, the flat per-transaction half. A cost to the shop, not DonutDash revenue — not written to dd_pos_card_fees. Never charged to the customer; that is card_surcharge_pct. 0 = no percentage fee.';

-- Top Donuts: 3.5% + $0.15 per card sale.
update public.dd_shops
   set pos_card_fee_pct = 3.50,
       updated_at       = now()
 where id = '22222222-2222-2222-2222-222222222222';

select name,
       card_surcharge_pct  as customer_pays_pct,
       pos_card_fee_pct    as merchant_pays_pct,
       pos_card_fee        as merchant_pays_flat,
       tax_rate
  from public.dd_shops
 where id = '22222222-2222-2222-2222-222222222222';
