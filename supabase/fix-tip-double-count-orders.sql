-- Correct two POS sales whose recorded total carried the tip twice.
--
-- The iPOSpays driver tested whether the gateway's reported Amount already
-- included the tip by comparing against an amount that already included it —
-- so on the POS-controlled tip path it looked for the tip twice, decided it
-- was missing, and added it again. Fixed in build 110; these two orders were
-- rung before that.
--
-- Only `total` is wrong. subtotal, tax, tip and card_surcharge_amount are all
-- correct on both rows, and the corrected total is simply their sum — which
-- is what the terminal actually charged and what the processor settled.
--
--   FD9EE  charged 23.53, recorded 25.53   (tip 2.00 counted twice)
--   93536  charged 45.47, recorded 48.47   (tip 3.00 counted twice)
--
-- Takings for 7 Oct 2026 drop by $5.00, toward what the bank actually
-- received. Sales tax is unaffected: `tax` is its own column and is right on
-- both rows.
--
-- Guarded three ways, so running it twice or against the wrong data does
-- nothing: it matches on the id AND the known-bad total, and only writes a
-- total it has recomputed from that row's own columns.

begin;

-- Show what is about to change.
select short_code,
       total                                                   as total_now,
       subtotal + tax + tip + coalesce(card_surcharge_amount, 0) as total_corrected,
       total - (subtotal + tax + tip + coalesce(card_surcharge_amount, 0)) as removing
  from public.dd_orders
 where id in (
   '31406bf8-6a9c-402d-9bd3-19020a617277',  -- FD9EE
   'df9e0da1-391f-4a76-98c8-bc7743e311e3'   -- 93536
 );

update public.dd_orders
   set total      = subtotal + tax + tip + coalesce(card_surcharge_amount, 0),
       updated_at = now()
 where id = '31406bf8-6a9c-402d-9bd3-19020a617277'
   and total = 25.53;                        -- refuses if already corrected

update public.dd_orders
   set total      = subtotal + tax + tip + coalesce(card_surcharge_amount, 0),
       updated_at = now()
 where id = 'df9e0da1-391f-4a76-98c8-bc7743e311e3'
   and total = 48.47;

-- Confirm. Both gaps must read 0.00 before committing.
select short_code,
       subtotal, tax, tip, card_surcharge_amount, total,
       total - (subtotal + tax + tip + coalesce(card_surcharge_amount, 0)) as gap
  from public.dd_orders
 where id in (
   '31406bf8-6a9c-402d-9bd3-19020a617277',
   'df9e0da1-391f-4a76-98c8-bc7743e311e3'
 );

commit;

-- To undo:
--   update public.dd_orders set total = 25.53
--    where id = '31406bf8-6a9c-402d-9bd3-19020a617277';
--   update public.dd_orders set total = 48.47
--    where id = 'df9e0da1-391f-4a76-98c8-bc7743e311e3';
