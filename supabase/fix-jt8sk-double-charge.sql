-- Order JT8SK: a duplicate charge the processor has already voided.
--
-- WHAT HAPPENED, 9 Oct 2026, Top Donuts, MASTERCARD ••••7819, $9.21:
--
--   08:22:45  SALE approved   ref 628213502510   -> order FHMME
--   08:23     SALE approved   ref 628213502513   -> order JT8SK
--   08:23     VOID of that second sale
--
-- The register sent the card a second time because it had not heard back
-- from the first. The retry went out under External ID
-- "pos-1791552192145-r1" — a FRESH reference id — which is exactly what
-- stops Dejavoo de-duping it, so the processor treated it as a new sale and
-- approved it. Two charges, one purchase.
--
-- The customer is already whole: the second sale was voided at the portal.
-- What is still wrong is on our side — both orders remain status 'delivered',
-- so the day's takings count $18.42 for a $9.21 purchase.
--
-- Cancelled, not deleted. The sale happened, was approved, and was reversed;
-- a row that disappears tells nobody that, and the next person comparing our
-- totals to a settlement report would find a gap with no explanation.
--
-- The fix that stops this recurring is in build 130: a charge we never heard
-- back from is no longer treated as a decline, and a retry re-sends the SAME
-- reference id so the gateway can refuse it. The register was still on an
-- older APK when this happened.

begin;

-- Both sides of the pair, before.
select short_code, created_at, total, status, card_ref_number
  from public.dd_orders
 where short_code in ('FHMME', 'JT8SK')
 order by created_at;

update public.dd_orders
   set status = 'cancelled',
       cancellation_reason =
         'Duplicate charge voided at the processor. The register re-sent the card after not '
      || 'hearing back from ref 628213502510; this second sale (ref 628213502513, approval '
      || '152120) was approved and then voided. The customer paid once.',
       reconcile_flag = 'duplicate_charge_voided',
       reconcile_note = 'Voided at iPOSpays 9 Oct 08:23. Paired with FHMME. Root cause fixed in build 130.',
       updated_at = now()
 where short_code = 'JT8SK'
   and card_ref_number = '628213502513'   -- refuses to touch anything else
   and status <> 'cancelled';             -- and does nothing if already done

-- After. FHMME stays delivered; JT8SK is cancelled and out of revenue.
select short_code, total, status, reconcile_flag
  from public.dd_orders
 where short_code in ('FHMME', 'JT8SK')
 order by created_at;

commit;

-- ─────────────────────────────────────────────────────────────────────────
-- SEPARATE, and only if the processor agrees
-- ─────────────────────────────────────────────────────────────────────────
-- JT8SK also wrote a row to dd_pos_card_fees. A sale voided before settlement
-- normally attracts no percentage fee, but whether the flat one still applies
-- is the processor's rule, not ours — so this is NOT run above. Check the
-- statement first; if iPOSpays charged nothing for the voided sale, run it.
--
--   delete from public.dd_pos_card_fees
--    where order_id = (select id from public.dd_orders where short_code = 'JT8SK');
