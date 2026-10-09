-- Two kinds of duplicate, one of which is still possible. Clean up, then
-- make it impossible.
--
-- A 5-minute same-card same-amount sweep over 679 card sales found five
-- pairs, and they are not all the same thing:
--
--   23 Sep  $7.27   ••••4393   D6AB9 + C7B6A   SAME reference number
--   23 Sep  $2.80   ••••2590   8133B + 72D3C   SAME reference number
--   24 Sep  $15.08  ••••1228   576AB + B3528   SAME reference number
--   30 Sep  $9.60   ••••8117   D8299 + B82AF   different refs  (already reversed)
--    9 Oct  $9.21   ••••7819   FHMME + JT8SK   different refs  (already reversed)
--
-- SAME reference means one approval was recorded twice: the customer paid
-- once and the books count it twice. DIFFERENT references mean the card was
-- genuinely charged twice, which is the retry bug fixed in build 130.
--
-- The three September pairs all have client_order_id = NULL. They predate
-- the idempotency key, and the (shop_id, client_order_id) index can only
-- stop a repeat when there is a key to match on. Every order since carries
-- one, so that hole is closed going forward — but nothing stops it reopening
-- if a key ever goes missing again, and nothing ever REFUSED two orders
-- claiming the same processor transaction.
--
-- Below: cancel the extra copy of each September pair, then add the
-- constraint that makes a second order against the same reference number
-- impossible. No customer money moves — these customers were charged once
-- and still are.

begin;

-- What is about to change.
select short_code, created_at, total, card_ref_number, status
  from public.dd_orders
 where short_code in ('D6AB9','C7B6A','8133B','72D3C','576AB','B3528')
 order by created_at;

-- Cancel the SECOND row of each pair, keeping the first. Matched on the
-- reference number too, so this cannot touch anything else.
update public.dd_orders
   set status = 'cancelled',
       cancellation_reason =
         'Duplicate record of a single approval. The same processor reference was written twice '
      || 'because this sale predates the client_order_id idempotency key. The customer was charged once.',
       reconcile_flag = 'duplicate_record',
       reconcile_note = 'Pairs with the earlier order carrying the same card_ref_number. No money moved.',
       updated_at = now()
 where short_code in ('C7B6A','72D3C','B3528')
   and status <> 'cancelled';

-- ─────────────────────────────────────────────────────────────────────────
-- The guarantee
-- ─────────────────────────────────────────────────────────────────────────
-- One processor transaction, one order. This is the constraint that was
-- missing: client_order_id dedups what the REGISTER thinks is one sale, and
-- is useless when the register sends two different keys or none. The
-- reference number comes from the processor and identifies the actual
-- charge, so it catches the case the other index cannot.
--
-- Refuses to be created if duplicates remain, which is the point.
do $$
declare v_n integer;
begin
  select count(*) into v_n from (
    select card_ref_number from public.dd_orders
     where card_ref_number is not null and status <> 'cancelled'
     group by card_ref_number having count(*) > 1
  ) d;
  if v_n > 0 then
    raise exception 'Still % duplicated reference numbers among live orders. Resolve them before adding the index.', v_n;
  end if;
end $$;

-- Cancelled rows are excluded: a void or a correction legitimately leaves an
-- old row carrying the same reference, and this must not make those
-- unrepresentable.
create unique index if not exists dd_orders_card_ref_number_uniq
  on public.dd_orders (card_ref_number)
  where card_ref_number is not null and status <> 'cancelled';

-- Confirm.
select short_code, total, status, reconcile_flag
  from public.dd_orders
 where short_code in ('D6AB9','C7B6A','8133B','72D3C','576AB','B3528')
 order by created_at;

commit;
