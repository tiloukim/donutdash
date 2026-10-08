-- Order 19FDC: a discount the wallet did not fund.
--
-- At 11:14 on 8 Oct the register applied $1.38 of DonutDash Cash to this
-- sale. The customer's wallet held $0.29 — an earlier sale twelve minutes
-- before had emptied it, and the register was still offering the balance it
-- had quoted then. dd_cash_redeem clamped the ledger to the $0.29 that
-- actually existed, so the customer's balance was never over-drawn and
-- dd_cash_wallet_drift stayed empty; the ledger and the wallet agreed
-- perfectly with each other. What disagreed was the ORDER, and nothing was
-- comparing those two.
--
-- The customer paid $1.38 less. $0.29 of that came from their balance and
-- $1.09 came from the shop.
--
-- NOTHING IS REWRITTEN HERE.
--
--   total                 is what the card was charged. A fact.
--   cash_redeemed_cents   is the discount the customer received, and it is
--                         what makes total equal its own parts — the orders
--                         route validates exactly that sum and refuses a sale
--                         whose parts disagree. "Correcting" it to 29 would
--                         leave a $1.09 hole in the identity and break the
--                         check on the one order that most needs to be
--                         readable.
--   the ledger            already records the truth: REDEEM -29c.
--
-- So this records what happened rather than editing what happened. The fix
-- that stops it recurring is in the code: the register clears its reward
-- quote at the start of every sale, and the orders route now compares what
-- it asked for against what dd_cash_redeem actually gave and raises this same
-- flag by itself.

begin;

-- What is about to change.
select short_code,
       total,
       cash_redeemed_cents                             as discount_applied_cents,
       (select -sum(amount_cents) from public.dd_cash_ledger l
         where l.order_id = o.id and l.transaction_type = 'REDEEM') as wallet_funded_cents,
       reconcile_flag
  from public.dd_orders o
 where short_code = '19FDC';

update public.dd_orders o
   set reconcile_flag = 'redeem_shortfall',
       reconcile_note = 'Register applied 1.38 of DonutDash Cash but the wallet only funded 0.29. '
                     || '1.09 of this sale''s discount was not backed by a balance. '
                     || 'Cause: the register re-offered a balance quote from a previous sale; '
                     || 'fixed in the app by clearing it at the start of each sale.',
       updated_at = now()
 where o.short_code = '19FDC'
   and o.cash_redeemed_cents = 138
   -- Only while the ledger really does disagree, so running this against
   -- corrected data does nothing.
   and (select -coalesce(sum(amount_cents), 0) from public.dd_cash_ledger l
         where l.order_id = o.id and l.transaction_type = 'REDEEM') = 29;

-- Confirm.
select short_code, total, cash_redeemed_cents, reconcile_flag, reconcile_note
  from public.dd_orders
 where short_code = '19FDC';

commit;

-- To undo:
--   update public.dd_orders set reconcile_flag = null, reconcile_note = null
--    where short_code = '19FDC';
