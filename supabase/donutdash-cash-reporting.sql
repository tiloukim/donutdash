-- DonutDash Cash — merchant reporting.
--
-- One function returning one JSON object, rather than a dozen endpoints or a
-- client that fetches the ledger and adds it up. Two reasons: RLS on
-- dd_cash_ledger deliberately gives a shop owner no direct read (the ledger
-- is customer money and the API decides who sees what), and a reporting
-- screen that issues ten queries at a counter is a reporting screen nobody
-- opens twice.
--
-- Every figure comes off indexed columns: shop_id for activity here,
-- funding_shop_id for what this shop owes.
--
-- Run in the Supabase SQL editor.

create or replace function public.dd_cash_report(
  p_shop_id uuid,
  p_from    timestamptz,
  p_to      timestamptz
) returns jsonb
language sql stable security definer set search_path = public as $$
with
-- Movements that happened AT this shop in the window.
window_rows as (
  select * from public.dd_cash_ledger
   where shop_id = p_shop_id and created_at >= p_from and created_at <= p_to
),
-- Everything this shop has ever FUNDED, which is what it still owes. Not
-- time-boxed: a liability does not expire because the report does.
funded as (
  select * from public.dd_cash_ledger where funding_shop_id = p_shop_id
),
-- A customer's first earn anywhere, to tell enrolment from repeat custom.
first_earn as (
  select customer_id, min(created_at) as at, (array_agg(shop_id order by created_at))[1] as shop_id
    from public.dd_cash_ledger
   where transaction_type = 'EARN'
   group by customer_id
),
top_customers as (
  select l.customer_id,
         u.name,
         sum(case when l.transaction_type = 'EARN' then l.amount_cents else 0 end) as earned_cents,
         sum(case when l.transaction_type = 'REDEEM' then -l.amount_cents else 0 end) as redeemed_cents
    from public.dd_cash_ledger l
    join public.dd_users u on u.id = l.customer_id
   where l.shop_id = p_shop_id
   group by l.customer_id, u.name
   order by earned_cents desc
   limit 10
)
select jsonb_build_object(
  'issued_cents', (
    select coalesce(sum(amount_cents), 0) from window_rows where transaction_type = 'EARN'
  ),
  'redeemed_cents', (
    select coalesce(sum(-amount_cents), 0) from window_rows where transaction_type = 'REDEEM'
  ),
  'reversed_cents', (
    select coalesce(sum(-amount_cents), 0) from window_rows where transaction_type = 'REFUND_REVERSAL'
  ),

  -- What this shop has funded and nobody has spent yet. Summing the signed
  -- column over funding_shop_id gives it directly: an EARN adds, a REDEEM of
  -- that money subtracts, a reversal subtracts.
  'outstanding_liability_cents', (
    select coalesce(sum(amount_cents), 0) from funded
  ),

  -- Cash funded elsewhere that this shop honoured. The other half of the
  -- settlement, and the number an owner will want to see before agreeing to
  -- accept cross-store rewards at all.
  'cross_store_accepted_cents', (
    select coalesce(sum(-amount_cents), 0) from window_rows
     where transaction_type = 'REDEEM'
       and funding_shop_id is not null and funding_shop_id <> p_shop_id
  ),
  -- And the reverse: this shop's money spent somewhere else.
  'funded_spent_elsewhere_cents', (
    select coalesce(sum(-amount_cents), 0) from funded
     where transaction_type = 'REDEEM'
       and redeeming_shop_id is not null and redeeming_shop_id <> p_shop_id
       and created_at >= p_from and created_at <= p_to
  ),

  'participating_customers', (
    select count(distinct customer_id) from public.dd_cash_ledger where shop_id = p_shop_id
  ),
  -- Enrolled HERE in the window: their very first earn anywhere happened at
  -- this shop, inside the window. A customer who first earned down the road
  -- is not this shop's new customer.
  'new_customers', (
    select count(*) from first_earn
     where shop_id = p_shop_id and at >= p_from and at <= p_to
  ),
  -- Customers who spent rewards here in the window and had earned more than
  -- once before doing so — the programme working as intended rather than a
  -- one-off.
  'repeat_customers_redeeming', (
    select count(distinct w.customer_id) from window_rows w
     where w.transaction_type = 'REDEEM'
       and (select count(*) from public.dd_cash_ledger e
             where e.customer_id = w.customer_id and e.transaction_type = 'EARN') > 1
  ),

  'top_customers', coalesce((
    select jsonb_agg(jsonb_build_object(
      'name', name, 'earned_cents', earned_cents, 'redeemed_cents', redeemed_cents
    )) from top_customers
  ), '[]'::jsonb)
);
$$;
