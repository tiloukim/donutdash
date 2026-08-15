-- Welcome-offer abuse fix for guest checkout.
--
-- The welcome (first-order) discount is granted to a "new customer" = a
-- customer_id with no prior non-cancelled orders. Guest checkout mints a fresh
-- anonymous user (new customer_id) every time, so a returning guest would
-- re-qualify for the discount on every order. This function lets the promo
-- logic also disqualify anyone whose PHONE has already placed an order —
-- matching on the last 10 digits so "(903) 555-1234", "9035551234", and
-- "+19035551234" all count as the same person.
create or replace function has_prior_order_by_phone(p text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from dd_orders
    where status <> 'cancelled'
      and length(regexp_replace(coalesce(customer_phone, ''), '\D', '', 'g')) >= 10
      and right(regexp_replace(customer_phone, '\D', '', 'g'), 10)
        = right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 10)
  );
$$;

-- Only the server (service role) computes eligibility. Don't expose this to
-- anon/authenticated clients (it would let anyone probe whether a phone has
-- ordered).
revoke all on function has_prior_order_by_phone(text) from public;
revoke all on function has_prior_order_by_phone(text) from anon;
revoke all on function has_prior_order_by_phone(text) from authenticated;
grant execute on function has_prior_order_by_phone(text) to service_role;
